import { db } from "../db/db.js";
import { feedback, laundryRecords, users } from "../db/schema.js";
import { eq, desc, avg, count } from "drizzle-orm";
import { AppError } from "../utils/AppError.js";

// ==========================================
// 1. Submit Laundry Feedback (Student Only)
// ==========================================
export const submitFeedback = async (req, res, next) => {
  try {
    const {
      laundryId,
      cleanlinessRating,
      timelinessRating,
      staffServiceRating,
      overallRating,
      comment,
    } = req.body;
    const studentId = req.user.id;

    // 1. Check laundry record exists
    const [record] = await db
      .select()
      .from(laundryRecords)
      .where(eq(laundryRecords.id, laundryId))
      .limit(1);

    if (!record) {
      throw new AppError("Laundry record not found", 404);
    }

    // 2. Verify student ownership
    if (record.studentId !== studentId) {
      throw new AppError("Forbidden: You cannot submit feedback for another student's laundry", 403);
    }

    // 3. Verify laundry has been delivered (Spec Section 19)
    if (record.status !== "delivered") {
      throw new AppError(
        `Feedback can only be submitted after laundry is delivered (current status: '${record.status}')`,
        400
      );
    }

    // 4. Verify no duplicate feedback for this laundry record
    const [existingFeedback] = await db
      .select({ id: feedback.id })
      .from(feedback)
      .where(eq(feedback.laundryId, laundryId))
      .limit(1);

    if (existingFeedback) {
      throw new AppError("Feedback has already been submitted for this laundry record", 409);
    }

    // 5. Insert feedback
    const [newFeedback] = await db
      .insert(feedback)
      .values({
        studentId,
        laundryId,
        cleanlinessRating,
        timelinessRating,
        staffServiceRating,
        overallRating,
        comment: comment || null,
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: "Feedback submitted successfully. Thank you for your review!",
      data: {
        feedback: newFeedback,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. View All Feedback (Admin Only)
// ==========================================
export const getAllFeedback = async (req, res, next) => {
  try {
    const records = await db.query.feedback.findMany({
      orderBy: [desc(feedback.createdAt)],
      with: {
        student: {
          columns: {
            id: true,
            name: true,
            studentId: true,
            email: true,
          },
        },
        laundry: {
          columns: {
            id: true,
            status: true,
            clothDetails: true,
            submittedAt: true,
            deliveredAt: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Feedback records retrieved successfully",
      data: {
        total: records.length,
        feedback: records,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. Feedback Analytics & Rating Distribution (Admin Only)
// ==========================================
export const getFeedbackAnalytics = async (req, res, next) => {
  try {
    const all = await db.select().from(feedback);
    const totalCount = all.length;

    if (totalCount === 0) {
      return res.status(200).json({
        success: true,
        message: "No feedback recorded yet",
        data: {
          totalReviews: 0,
          averages: {
            cleanliness: 0,
            timeliness: 0,
            staffService: 0,
            overall: 0,
          },
          distribution: {
            5: 0,
            4: 0,
            3: 0,
            2: 0,
            1: 0,
          },
        },
      });
    }

    let sumClean = 0;
    let sumTime = 0;
    let sumService = 0;
    let sumOverall = 0;
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    for (const f of all) {
      sumClean += f.cleanlinessRating;
      sumTime += f.timelinessRating;
      sumService += f.staffServiceRating;
      sumOverall += f.overallRating;

      if (distribution[f.overallRating] !== undefined) {
        distribution[f.overallRating]++;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Feedback analytics computed successfully",
      data: {
        totalReviews: totalCount,
        averages: {
          cleanliness: Number((sumClean / totalCount).toFixed(2)),
          timeliness: Number((sumTime / totalCount).toFixed(2)),
          staffService: Number((sumService / totalCount).toFixed(2)),
          overall: Number((sumOverall / totalCount).toFixed(2)),
        },
        distribution,
      },
    });
  } catch (error) {
    next(error);
  }
};
