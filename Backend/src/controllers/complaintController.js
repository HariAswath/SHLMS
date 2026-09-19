import { db } from "../db/db.js";
import { complaints, laundryRecords, notifications, users } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { AppError } from "../utils/AppError.js";

// ==========================================
// 1. Create Complaint (Student or Admin)
// ==========================================
export const createComplaint = async (req, res, next) => {
  try {
    const { laundryId, category, description, imageUrl } = req.body;
    const studentId = req.user.id;

    // If laundryId is provided, verify it exists and belongs to the student
    if (laundryId) {
      const [laundry] = await db
        .select()
        .from(laundryRecords)
        .where(eq(laundryRecords.id, laundryId))
        .limit(1);

      if (!laundry) {
        throw new AppError("Associated laundry record not found", 404);
      }

      if (req.user.role === "student" && laundry.studentId !== studentId) {
        throw new AppError(
          "Forbidden: You cannot file a complaint against another student's laundry record",
          403
        );
      }
    }

    const [newComplaint] = await db
      .insert(complaints)
      .values({
        studentId,
        laundryId: laundryId || null,
        category,
        description,
        imageUrl: imageUrl || null,
        status: "open",
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: "Complaint submitted successfully",
      data: {
        complaint: newComplaint,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. Get Complaints (Student views own, Staff/Admin views all)
// ==========================================
export const getComplaints = async (req, res, next) => {
  try {
    const { status, category } = req.query;
    const conditions = [];

    // Students can only view their own complaints
    if (req.user.role === "student") {
      conditions.push(eq(complaints.studentId, req.user.id));
    }

    if (status) {
      conditions.push(eq(complaints.status, status));
    }

    if (category) {
      conditions.push(eq(complaints.category, category));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const list = await db.query.complaints.findMany({
      where: whereClause,
      orderBy: [desc(complaints.createdAt)],
      with: {
        student: {
          columns: {
            id: true,
            name: true,
            studentId: true,
            email: true,
            barcodeValue: true,
          },
        },
        laundry: true,
        resolver: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Complaints retrieved successfully",
      data: {
        total: list.length,
        complaints: list,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. Get Complaint By ID
// ==========================================
export const getComplaintById = async (req, res, next) => {
  try {
    const complaintId = parseInt(req.params.id, 10);
    if (isNaN(complaintId)) {
      throw new AppError("Invalid complaint ID parameter", 400);
    }

    const complaint = await db.query.complaints.findFirst({
      where: eq(complaints.id, complaintId),
      with: {
        student: {
          columns: {
            id: true,
            name: true,
            studentId: true,
            email: true,
            barcodeValue: true,
          },
        },
        laundry: true,
        resolver: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!complaint) {
      throw new AppError("Complaint not found", 404);
    }

    // Role check: Student can only view their own complaint
    if (req.user.role === "student" && complaint.studentId !== req.user.id) {
      throw new AppError("Forbidden: You are not authorized to view this complaint", 403);
    }

    return res.status(200).json({
      success: true,
      message: "Complaint retrieved successfully",
      data: {
        complaint,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. Update Complaint Status & Remarks (Admin Only)
// ==========================================
export const updateComplaintStatus = async (req, res, next) => {
  try {
    const complaintId = parseInt(req.params.id, 10);
    if (isNaN(complaintId)) {
      throw new AppError("Invalid complaint ID parameter", 400);
    }

    const { status: targetStatus, adminRemarks } = req.body;

    const [complaint] = await db
      .select()
      .from(complaints)
      .where(eq(complaints.id, complaintId))
      .limit(1);

    if (!complaint) {
      throw new AppError("Complaint not found", 404);
    }

    const isResolvedOrClosed = ["resolved", "rejected", "closed"].includes(targetStatus);

    const updateData = {
      status: targetStatus,
      adminRemarks: adminRemarks !== undefined ? adminRemarks : complaint.adminRemarks,
      resolvedBy: isResolvedOrClosed ? req.user.id : complaint.resolvedBy,
      resolvedAt: isResolvedOrClosed ? new Date() : complaint.resolvedAt,
      updatedAt: new Date(),
    };

    const [updatedComplaint] = await db
      .update(complaints)
      .set(updateData)
      .where(eq(complaints.id, complaintId))
      .returning();

    // Notify student about status change
    await db.insert(notifications).values({
      userId: complaint.studentId,
      type: "complaint",
      title: "Complaint Status Updated",
      message: `Your complaint #${complaint.id} (${complaint.category}) status is now '${targetStatus}'.${
        adminRemarks ? ` Admin Remarks: "${adminRemarks}"` : ""
      }`,
    });

    return res.status(200).json({
      success: true,
      message: `Complaint status updated to '${targetStatus}'`,
      data: {
        complaint: updatedComplaint,
      },
    });
  } catch (error) {
    next(error);
  }
};
