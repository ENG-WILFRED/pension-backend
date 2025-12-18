import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserOtpFields1766048154234 implements MigrationInterface {
    name = 'AddUserOtpFields1766048154234'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "username" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username")`);
        await queryRunner.query(`ALTER TABLE "users" ADD "dateOfBirth" date`);
        await queryRunner.query(`ALTER TABLE "users" ADD "gender" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "maritalStatus" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "spouseName" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "spouseDob" date`);
        await queryRunner.query(`ALTER TABLE "users" ADD "children" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "numberOfChildren" integer`);
        await queryRunner.query(`ALTER TABLE "users" ADD "failedLoginAttempts" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "otpCode" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "otpExpiry" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD "nationalId" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "address" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "city" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "country" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "occupation" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "employer" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "salary" numeric`);
        await queryRunner.query(`ALTER TABLE "users" ADD "contributionRate" numeric`);
        await queryRunner.query(`ALTER TABLE "users" ADD "retirementAge" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "retirementAge"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "contributionRate"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "salary"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "employer"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "occupation"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "country"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "city"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "address"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "nationalId"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otpExpiry"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otpCode"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "failedLoginAttempts"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "numberOfChildren"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "children"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "spouseDob"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "spouseName"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "maritalStatus"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "gender"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "dateOfBirth"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
    }

}
