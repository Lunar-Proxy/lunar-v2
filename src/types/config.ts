export interface ConfigTypes {
  port: number;
  logType: 'ERROR' | 'INFO' | 'DEBUG' | 'WARN';
  auth: {
    protect: boolean;
    log: boolean;
    users: { [username: string]: string }[];
  };
}
