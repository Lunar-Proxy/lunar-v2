export interface ConfigTypes {
  port: number;
  LogType: "ERROR" | "INFO" | "DEBUG";
  auth: {
    protect: boolean;
    log: boolean;
    users: { [username: string]: string }[];
  };
}
