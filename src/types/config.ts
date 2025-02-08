export interface ConfigTypes {
  port: number;
  auth: {
    protect: boolean;
    log: boolean;
    users: { [username: string]: string }[];
  };
}
