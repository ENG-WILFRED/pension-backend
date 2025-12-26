import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1766757332769 implements MigrationInterface {
    name = 'Init1766757332769'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "account_types" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, "interestRate" numeric(5,2), "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0ca9a8184d6c97c518fc317e7a6" UNIQUE ("name"), CONSTRAINT "PK_1944ce0e8e4a9f29fa1d4fbe4ce" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "account_types"`);
    }

}
