import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLanguageToUser1766256054556 implements MigrationInterface {
    name = 'AddLanguageToUser1766256054556'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "language" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "language"`);
    }

}
