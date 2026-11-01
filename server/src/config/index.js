/**
 * MT Nexus Global ERP — Central Configuration Manager
 */

require("dotenv").config();

const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "5000", 10),
  host: process.env.HOST || "127.0.0.1",
  databaseUrl: process.env.DATABASE_URL,
  org: {
    code: process.env.DEFAULT_ORG_CODE || "MT-NEXUS-HQ",
    name: process.env.DEFAULT_ORG_NAME || "MT Nexus Global",
  },
};

module.exports = config;
