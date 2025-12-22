import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1766417572844 implements MigrationInterface {
    name = 'Init1766417572844'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."accounts_accounttype_enum" AS ENUM('MANDATORY', 'VOLUNTARY', 'EMPLOYER', 'SAVINGS', 'WITHDRAWAL', 'BENEFITS')`);
        await queryRunner.query(`CREATE TYPE "public"."accounts_accountstatus_enum" AS ENUM('ACTIVE', 'SUSPENDED', 'CLOSED', 'FROZEN', 'DECEASED')`);
        await queryRunner.query(`CREATE TYPE "public"."accounts_riskprofile_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH')`);
        await queryRunner.query(`CREATE TYPE "public"."accounts_compliancestatus_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')`);
        await queryRunner.query(`CREATE TABLE "accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "accountNumber" character varying NOT NULL, "accountType" "public"."accounts_accounttype_enum" NOT NULL DEFAULT 'MANDATORY', "accountStatus" "public"."accounts_accountstatus_enum" NOT NULL DEFAULT 'ACTIVE', "currentBalance" numeric(18,2) NOT NULL DEFAULT '0', "availableBalance" numeric(18,2) NOT NULL DEFAULT '0', "lockedBalance" numeric(18,2) NOT NULL DEFAULT '0', "employeeContributions" numeric(18,2) NOT NULL DEFAULT '0', "employerContributions" numeric(18,2) NOT NULL DEFAULT '0', "voluntaryContributions" numeric(18,2) NOT NULL DEFAULT '0', "interestEarned" numeric(18,2) NOT NULL DEFAULT '0', "investmentReturns" numeric(18,2) NOT NULL DEFAULT '0', "dividendsEarned" numeric(18,2) NOT NULL DEFAULT '0', "totalWithdrawn" numeric(18,2) NOT NULL DEFAULT '0', "penaltiesApplied" numeric(18,2) NOT NULL DEFAULT '0', "taxWithheld" numeric(18,2) NOT NULL DEFAULT '0', "interestRate" numeric(5,2), "investmentPlanId" uuid, "riskProfile" "public"."accounts_riskprofile_enum" NOT NULL DEFAULT 'MEDIUM', "openedAt" TIMESTAMP WITH TIME ZONE, "lastContributionAt" TIMESTAMP WITH TIME ZONE, "lastWithdrawalAt" TIMESTAMP WITH TIME ZONE, "maturityDate" date, "retirementDate" date, "lastTransactionId" uuid, "version" integer NOT NULL DEFAULT '0', "kycVerified" boolean NOT NULL DEFAULT false, "complianceStatus" "public"."accounts_compliancestatus_enum" NOT NULL DEFAULT 'PENDING', "isTaxExempt" boolean NOT NULL DEFAULT false, "currency" character varying(3) NOT NULL DEFAULT 'KES', "countryCode" character varying(2) NOT NULL DEFAULT 'KE', "beneficiaryDetails" json, "metadata" json, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c57d6a982eeaa1d115687b17b63" UNIQUE ("accountNumber"), CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3aa23c0a6d107393e8b40e3e2a" ON "accounts" ("userId") `);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "accountId" uuid`);
        await queryRunner.query(`ALTER TABLE "users" ADD "kraPin" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_2b5a538e1f7d91fb2866550b0c8" UNIQUE ("kraPin")`);
        await queryRunner.query(`ALTER TABLE "users" ADD "nssfNumber" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_ae8b0dee3d2574f7bc3a7e6f65b" UNIQUE ("nssfNumber")`);
        await queryRunner.query(`ALTER TABLE "users" ADD "kraVerified" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD "nssfVerified" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`CREATE INDEX "IDX_26d8aec71ae9efbe468043cd2b" ON "transactions" ("accountId") `);
        await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "FK_3aa23c0a6d107393e8b40e3e2a6" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_26d8aec71ae9efbe468043cd2b9" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_26d8aec71ae9efbe468043cd2b9"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "FK_3aa23c0a6d107393e8b40e3e2a6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_26d8aec71ae9efbe468043cd2b"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "nssfVerified"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "kraVerified"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_ae8b0dee3d2574f7bc3a7e6f65b"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "nssfNumber"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_2b5a538e1f7d91fb2866550b0c8"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "kraPin"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "accountId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3aa23c0a6d107393e8b40e3e2a"`);
        await queryRunner.query(`DROP TABLE "accounts"`);
        await queryRunner.query(`DROP TYPE "public"."accounts_compliancestatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."accounts_riskprofile_enum"`);
        await queryRunner.query(`DROP TYPE "public"."accounts_accountstatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."accounts_accounttype_enum"`);
    }

}
