import fs from "fs";
import path from "path";

export type MaintenanceConfig = {
  enabled: boolean;
  title: string;
  message: string;
  gifUrl: string;
  updatedAt?: string;
};

const DEFAULT_CONFIG: MaintenanceConfig = {
  enabled: false,
  title: "המערכת בשדרוג",
  message: "אנחנו מבצעים שיפורים במערכת. נחזור בקרוב.",
  gifUrl: "/maintenance.gif",
};

const filePath = path.join(process.cwd(), "data", "maintenance.json");

export function getMaintenanceConfig(): MaintenanceConfig {
  try {
    if (!fs.existsSync(filePath)) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(filePath, "utf8")) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveMaintenanceConfig(config: MaintenanceConfig) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf8");
}
