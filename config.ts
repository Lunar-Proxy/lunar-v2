import type { ConfigTypes } from '@/types/config';
const config: ConfigTypes = {
  port: 8080, // The port lunar runs on (Default: 8080)
  logType: 'ERROR', // The type of logging to use (Go to wiki for more info) (Default: Error)
  auth: {
    protect: false, // Enable or disable authentication (Default: false)
    // You do not need to edit below if protect is set to false.
    log: true, // Logs when someone authicates (Default: true)
    users: [
      // To add more users, follow this format:
      {
        lunar: 'lunariscool', // Replace to whatever you want format is username: "password"
      },
    ],
  },
};

export default config;
