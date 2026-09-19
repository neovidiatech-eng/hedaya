import cron from "node-cron";
import * as db from "../../database/dbService.js";
import { finalizeSession } from "../../Modules/Schedules/schedules.controller.js";

export const startCronJobs = () => {
  // Run every 10 minutes to auto-finalize sessions whose end_time has passed
  cron.schedule("0 3 */2 * *", async () => {
    try {
      const now = new Date();
      const pastSessions = await db.findMany({
        model: "schedule",
        where: {
          end_time: { lte: now },
          status: { in: ["scheduled", "planned", "ongoing"] },
        },
        select: { id: true },
      });

      for (const session of pastSessions) {
        await finalizeSession(session.id);
      }
    } catch (error) {
      console.error("Cron job error finalizing sessions:", error);
    }
  });

  console.log("Cron jobs initialized.");
};

