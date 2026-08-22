import "dotenv/config";
import { PrismaPg } from '@prisma/adapter-pg'
import { envConfig } from "../_config/env";
import { PrismaClient } from "../generated/prisma";



const connectionString = envConfig.DATABASE_URL;
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

export { prisma }