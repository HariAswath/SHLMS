import { db } from "../db/db.js";
import { lostFound, lostFoundClaims, notifications, users } from "../db/schema.js";
import { eq, and, desc, ilike } from "drizzle-orm";
import { AppError } from "../utils/AppError.js";

// ==========================================
// 1. Upload Lost & Found Item (Staff & Admin)
// ==========================================
export const createLostFoundItem = async (req, res, next) => {
  try {
    const { title, description, category, color, imageUrl, foundDate } = req.body;
    const staffId = req.user.id;

    const [item] = await db
      .insert(lostFound)
      .values({
        reportedByStaffId: staffId,
        title,
        description: description || null,
        category,
        color: color || null,
        imageUrl: imageUrl || null,
        foundDate: foundDate ? new Date(foundDate) : new Date(),
        status: "available",
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: "Lost & found item recorded successfully",
      data: {
        item,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. Browse Lost & Found Items (All Authenticated)
// ==========================================
export const getLostFoundItems = async (req, res, next) => {
  try {
    const { status, category, search } = req.query;
    const conditions = [];

    if (status) {
      conditions.push(eq(lostFound.status, status));
    }

    if (category) {
      conditions.push(eq(lostFound.category, category));
    }

    if (search) {
      conditions.push(ilike(lostFound.title, `%${search.trim()}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db.query.lostFound.findMany({
      where: whereClause,
      orderBy: [desc(lostFound.createdAt)],
      with: {
        reporter: {
          columns: {
            id: true,
            name: true,
            role: true,
          },
        },
        claims: {
          with: {
            student: {
              columns: {
                id: true,
                name: true,
                studentId: true,
              },
            },
          },
        },
      },
    });

    // If user is a student, redact claims from other students for privacy
    const sanitizedItems = items.map((item) => {
      if (req.user.role === "student") {
        return {
          ...item,
          claims: item.claims.filter((c) => c.studentId === req.user.id),
        };
      }
      return item;
    });

    return res.status(200).json({
      success: true,
      message: "Lost & found items retrieved successfully",
      data: {
        total: sanitizedItems.length,
        items: sanitizedItems,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. Get Single Lost & Found Item By ID
// ==========================================
export const getLostFoundItemById = async (req, res, next) => {
  try {
    const itemId = parseInt(req.params.id, 10);
    if (isNaN(itemId)) {
      throw new AppError("Invalid item ID parameter", 400);
    }

    const item = await db.query.lostFound.findFirst({
      where: eq(lostFound.id, itemId),
      with: {
        reporter: {
          columns: {
            id: true,
            name: true,
            role: true,
          },
        },
        claims: {
          with: {
            student: {
              columns: {
                id: true,
                name: true,
                studentId: true,
              },
            },
            reviewer: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new AppError("Lost & found item not found", 404);
    }

    if (req.user.role === "student") {
      item.claims = item.claims.filter((c) => c.studentId === req.user.id);
    }

    return res.status(200).json({
      success: true,
      message: "Item details retrieved successfully",
      data: {
        item,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. Submit Item Claim (Student)
// ==========================================
export const claimLostFoundItem = async (req, res, next) => {
  try {
    const itemId = parseInt(req.params.id, 10);
    const { description } = req.body;
    const studentId = req.user.id;

    if (isNaN(itemId)) {
      throw new AppError("Invalid item ID parameter", 400);
    }

    // 1. Check item exists
    const [item] = await db
      .select()
      .from(lostFound)
      .where(eq(lostFound.id, itemId))
      .limit(1);

    if (!item) {
      throw new AppError("Lost & found item not found", 404);
    }

    if (item.status !== "available") {
      throw new AppError(`Item is not available for claims (current status: '${item.status}')`, 409);
    }

    // 2. Check duplicate pending claim by same student
    const [existingClaim] = await db
      .select()
      .from(lostFoundClaims)
      .where(
        and(
          eq(lostFoundClaims.itemId, itemId),
          eq(lostFoundClaims.studentId, studentId),
          eq(lostFoundClaims.status, "pending")
        )
      )
      .limit(1);

    if (existingClaim) {
      throw new AppError("You already have an active pending claim for this item", 409);
    }

    // 3. Create claim
    const [newClaim] = await db
      .insert(lostFoundClaims)
      .values({
        itemId,
        studentId,
        description,
        status: "pending",
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: "Claim submitted successfully. Administration will review your claim.",
      data: {
        claim: newClaim,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 5. Review & Decide Claim (Admin Only)
// ==========================================
export const reviewClaim = async (req, res, next) => {
  try {
    const claimId = parseInt(req.params.claimId, 10);
    const { status: decision, remarks } = req.body;
    const adminId = req.user.id;

    if (isNaN(claimId)) {
      throw new AppError("Invalid claim ID parameter", 400);
    }

    // 1. Fetch claim
    const [claim] = await db
      .select()
      .from(lostFoundClaims)
      .where(eq(lostFoundClaims.id, claimId))
      .limit(1);

    if (!claim) {
      throw new AppError("Claim not found", 404);
    }

    if (claim.status !== "pending") {
      throw new AppError(`This claim has already been reviewed (status: '${claim.status}')`, 409);
    }

    // 2. Fetch parent item
    const [item] = await db
      .select()
      .from(lostFound)
      .where(eq(lostFound.id, claim.itemId))
      .limit(1);

    // 3. Update claim
    const now = new Date();
    const [updatedClaim] = await db
      .update(lostFoundClaims)
      .set({
        status: decision,
        remarks: remarks || null,
        reviewedBy: adminId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(lostFoundClaims.id, claimId))
      .returning();

    // 4. If approved, mark item as claimed
    if (decision === "approved") {
      await db
        .update(lostFound)
        .set({
          status: "claimed",
          updatedAt: now,
        })
        .where(eq(lostFound.id, claim.itemId));
    }

    // 5. Notify student
    await db.insert(notifications).values({
      userId: claim.studentId,
      type: "claim",
      title: decision === "approved" ? "Claim Approved!" : "Claim Rejected",
      message: `Your claim for '${item ? item.title : "item"}' has been ${decision}.${
        remarks ? ` Admin remarks: "${remarks}"` : ""
      }`,
    });

    return res.status(200).json({
      success: true,
      message: `Claim has been ${decision} successfully`,
      data: {
        claim: updatedClaim,
      },
    });
  } catch (error) {
    next(error);
  }
};
