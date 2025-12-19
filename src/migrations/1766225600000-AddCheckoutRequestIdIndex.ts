import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCheckoutRequestIdIndex1766225600000 implements MigrationInterface {
    name = 'AddCheckoutRequestIdIndex1766225600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if the column exists before adding it
        const table = await queryRunner.getTable("transactions");
        const checkoutIdColumn = table?.columns.find(col => col.name === "checkoutRequestId");

        if (!checkoutIdColumn) {
            // Column doesn't exist, create it
            await queryRunner.query(`ALTER TABLE "transactions" ADD "checkoutRequestId" character varying`);
        }

        // Add index for fast lookups (idempotent - checks if it exists)
        const indexResult = await queryRunner.query(`
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'transactions' 
            AND indexname = 'IDX_transactions_checkoutRequestId'
        `);

        if (!indexResult || indexResult.length === 0) {
            await queryRunner.query(`CREATE INDEX "IDX_transactions_checkoutRequestId" ON "transactions" ("checkoutRequestId")`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the index if it exists
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_checkoutRequestId"`);
        
        // Drop the column if it exists
        const table = await queryRunner.getTable("transactions");
        const checkoutIdColumn = table?.columns.find(col => col.name === "checkoutRequestId");
        
        if (checkoutIdColumn) {
            await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "checkoutRequestId"`);
        }
    }
}
