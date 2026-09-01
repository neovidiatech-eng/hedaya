import cron from "node-cron";
import * as db from "../../database/dbService.js";
import { createNotification, createAdminNotification } from "../../Modules/Notifications/notifications.controller.js";

export const startCronJobs = () => {
     console.log("Cron jobs initialized.");
};
