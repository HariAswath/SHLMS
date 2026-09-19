import { db } from "../db/db.js";
import {
  users,
  hostels,
  rooms,
  laundryGroups,
  schedules,
  laundryRecords,
  complaints,
  lostFound,
  lostFoundClaims,
  feedback,
} from "../db/schema.js";
import { eq, and, gte, lte, inArray, desc, sql } from "drizzle-orm";
import { AppError } from "../utils/AppError.js";

// ==========================================
// 1. Dashboard Executive Summary
// ==========================================
export const getDashboardSummary = async (req, res, next) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];

    // Parallel fetch counts for high operational performance
    const [
      allUsers,
      allHostels,
      allRooms,
      allGroups,
      allLaundry,
      allComplaints,
      allLostFound,
      allClaims,
      allFeedback,
      todaySchedule,
    ] = await Promise.all([
      db.select({ id: users.id, role: users.role, status: users.status }).from(users),
      db.select({ id: hostels.id }).from(hostels),
      db.select({ id: rooms.id }).from(rooms),
      db.select({ id: laundryGroups.id }).from(laundryGroups),
      db.select({ id: laundryRecords.id, status: laundryRecords.status, submittedAt: laundryRecords.submittedAt, deliveredAt: laundryRecords.deliveredAt }).from(laundryRecords),
      db.select({ id: complaints.id, status: complaints.status }).from(complaints),
      db.select({ id: lostFound.id, status: lostFound.status }).from(lostFound),
      db.select({ id: lostFoundClaims.id, status: lostFoundClaims.status }).from(lostFoundClaims),
      db.select({ overallRating: feedback.overallRating }).from(feedback),
      db.query.schedules.findFirst({
        where: eq(schedules.scheduleDate, todayStr),
        with: {
          group: {
            with: {
              hostel: true,
            },
          },
        },
      }),
    ]);

    // Aggregate counts
    const totalStudents = allUsers.filter((u) => u.role === "student" && u.status === "active").length;
    const totalStaff = allUsers.filter((u) => u.role === "staff" && u.status === "active").length;
    const totalHostels = allHostels.length;
    const totalRooms = allRooms.length;
    const totalLaundryGroups = allGroups.length;

    // Laundry stats
    let activeLaundry = 0;
    let receivedToday = 0;
    let deliveredToday = 0;

    for (const rec of allLaundry) {
      if (rec.status === "received" || rec.status === "ready_for_pickup") {
        activeLaundry++;
      }

      if (rec.submittedAt) {
        const subDate = new Date(rec.submittedAt).toISOString().split("T")[0];
        if (subDate === todayStr) receivedToday++;
      }

      if (rec.deliveredAt) {
        const delDate = new Date(rec.deliveredAt).toISOString().split("T")[0];
        if (delDate === todayStr) deliveredToday++;
      }
    }

    // Complaints stats
    const openComplaints = allComplaints.filter(
      (c) => c.status === "open" || c.status === "under_review"
    ).length;
    const resolvedComplaints = allComplaints.filter((c) => c.status === "resolved").length;

    // Lost & Found stats
    const availableItems = allLostFound.filter((i) => i.status === "available").length;
    const pendingClaims = allClaims.filter((c) => c.status === "pending").length;

    // Feedback rating average
    const totalReviews = allFeedback.length;
    const avgRating =
      totalReviews > 0
        ? Number(
            (
              allFeedback.reduce((sum, f) => sum + f.overallRating, 0) / totalReviews
            ).toFixed(2)
          )
        : 0;

    return res.status(200).json({
      success: true,
      message: "Dashboard summary retrieved successfully",
      data: {
        infrastructure: {
          totalStudents,
          totalStaff,
          totalHostels,
          totalRooms,
          totalLaundryGroups,
        },
        laundryOperations: {
          activeLaundry,
          receivedToday,
          deliveredToday,
          totalProcessedAllTime: allLaundry.length,
        },
        complaints: {
          total: allComplaints.length,
          open: openComplaints,
          resolved: resolvedComplaints,
        },
        lostAndFound: {
          availableItems,
          pendingClaims,
        },
        customerSatisfaction: {
          totalReviews,
          averageOverallRating: avgRating,
        },
        todaySchedule: todaySchedule || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. Operational Laundry Report
// ==========================================
export const getLaundryReport = async (req, res, next) => {
  try {
    const { startDate, endDate, status } = req.query;

    const allRecords = await db.query.laundryRecords.findMany({
      orderBy: [desc(laundryRecords.submittedAt)],
      with: {
        student: {
          columns: {
            id: true,
            name: true,
            studentId: true,
          },
        },
        schedule: {
          with: {
            group: true,
          },
        },
      },
    });

    // In-memory date filter for database independence & flexibility
    const filtered = allRecords.filter((rec) => {
      const subDate = new Date(rec.submittedAt).toISOString().split("T")[0];
      if (startDate && subDate < startDate) return false;
      if (endDate && subDate > endDate) return false;
      if (status && rec.status !== status) return false;
      return true;
    });

    // Compute metrics
    const byStatus = {
      received: 0,
      ready_for_pickup: 0,
      delivered: 0,
    };

    const categoryBreakdown = {};
    let totalClothesCount = 0;
    const dailyMap = {};

    for (const rec of filtered) {
      if (byStatus[rec.status] !== undefined) {
        byStatus[rec.status]++;
      }

      // Parse clothDetails
      if (rec.clothDetails && typeof rec.clothDetails === "object") {
        for (const [cat, count] of Object.entries(rec.clothDetails)) {
          const num = typeof count === "number" ? count : parseInt(count, 10) || 0;
          categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + num;
          totalClothesCount += num;
        }
      }

      // Group by submission day
      const subDate = new Date(rec.submittedAt).toISOString().split("T")[0];
      if (!dailyMap[subDate]) {
        dailyMap[subDate] = { date: subDate, submittedCount: 0, deliveredCount: 0 };
      }
      dailyMap[subDate].submittedCount++;

      if (rec.deliveredAt) {
        const delDate = new Date(rec.deliveredAt).toISOString().split("T")[0];
        if (!dailyMap[delDate]) {
          dailyMap[delDate] = { date: delDate, submittedCount: 0, deliveredCount: 0 };
        }
        dailyMap[delDate].deliveredCount++;
      }
    }

    const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    return res.status(200).json({
      success: true,
      message: "Laundry report generated successfully",
      data: {
        summary: {
          totalRecords: filtered.length,
          byStatus,
          totalClothesCount,
          categoryBreakdown,
        },
        dailyTrend,
        records: filtered.slice(0, 100), // Return recent 100
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. Complaints Operational Report
// ==========================================
export const getComplaintsReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const allComplaints = await db.query.complaints.findMany({
      orderBy: [desc(complaints.createdAt)],
      with: {
        student: {
          columns: {
            id: true,
            name: true,
            studentId: true,
          },
        },
        resolver: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    const filtered = allComplaints.filter((c) => {
      const cDate = new Date(c.createdAt).toISOString().split("T")[0];
      if (startDate && cDate < startDate) return false;
      if (endDate && cDate > endDate) return false;
      return true;
    });

    const byStatus = {
      open: 0,
      under_review: 0,
      resolved: 0,
      rejected: 0,
      closed: 0,
    };

    const byCategory = {
      missing_clothes: 0,
      damaged_clothes: 0,
      wrong_item: 0,
      delay: 0,
      other: 0,
    };

    let totalResolutionHours = 0;
    let resolvedCount = 0;

    for (const c of filtered) {
      if (byStatus[c.status] !== undefined) byStatus[c.status]++;
      if (byCategory[c.category] !== undefined) byCategory[c.category]++;

      if (c.resolvedAt && (c.status === "resolved" || c.status === "closed")) {
        const diffMs = new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime();
        const diffHours = Math.max(0, diffMs / (1000 * 60 * 60));
        totalResolutionHours += diffHours;
        resolvedCount++;
      }
    }

    const total = filtered.length;
    const resolvedOrClosed = byStatus.resolved + byStatus.closed;
    const resolutionRate = total > 0 ? Number(((resolvedOrClosed / total) * 100).toFixed(1)) : 0;
    const averageResolutionTimeHours =
      resolvedCount > 0 ? Number((totalResolutionHours / resolvedCount).toFixed(2)) : 0;

    return res.status(200).json({
      success: true,
      message: "Complaints report generated successfully",
      data: {
        summary: {
          totalComplaints: total,
          byStatus,
          byCategory,
          resolutionRate: `${resolutionRate}%`,
          averageResolutionTimeHours,
        },
        complaints: filtered.slice(0, 100),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. Feedback & Satisfaction Report
// ==========================================
export const getFeedbackReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const allFeedback = await db.query.feedback.findMany({
      orderBy: [desc(feedback.createdAt)],
      with: {
        student: {
          columns: {
            id: true,
            name: true,
            studentId: true,
          },
        },
      },
    });

    const filtered = allFeedback.filter((f) => {
      const fDate = new Date(f.createdAt).toISOString().split("T")[0];
      if (startDate && fDate < startDate) return false;
      if (endDate && fDate > endDate) return false;
      return true;
    });

    const total = filtered.length;
    if (total === 0) {
      return res.status(200).json({
        success: true,
        message: "Feedback report generated successfully (0 records)",
        data: {
          summary: {
            totalReviews: 0,
            averages: {
              cleanliness: 0,
              timeliness: 0,
              staffService: 0,
              overall: 0,
            },
            distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          },
          feedback: [],
        },
      });
    }

    let sumClean = 0;
    let sumTime = 0;
    let sumStaff = 0;
    let sumOverall = 0;
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    for (const f of filtered) {
      sumClean += f.cleanlinessRating;
      sumTime += f.timelinessRating;
      sumStaff += f.staffServiceRating;
      sumOverall += f.overallRating;

      if (distribution[f.overallRating] !== undefined) {
        distribution[f.overallRating]++;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Feedback report generated successfully",
      data: {
        summary: {
          totalReviews: total,
          averages: {
            cleanliness: Number((sumClean / total).toFixed(2)),
            timeliness: Number((sumTime / total).toFixed(2)),
            staffService: Number((sumStaff / total).toFixed(2)),
            overall: Number((sumOverall / total).toFixed(2)),
          },
          distribution,
        },
        feedback: filtered.slice(0, 100),
      },
    });
  } catch (error) {
    next(error);
  }
};
