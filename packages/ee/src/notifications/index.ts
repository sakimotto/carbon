import { notificationRegistry } from "./registry";
import { LinearNotificationService } from "./services/linear";
import { SlackNotificationService } from "./services/slack";

notificationRegistry.register(new SlackNotificationService());
notificationRegistry.register(new LinearNotificationService());

export * from "./pipeline";
export * from "./registry";
export * from "./types";
export { SlackNotificationService };
