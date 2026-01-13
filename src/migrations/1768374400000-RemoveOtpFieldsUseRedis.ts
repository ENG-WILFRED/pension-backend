import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RemoveOtpFieldsUseRedis1768374400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop otpCode column
    await queryRunner.dropColumn('users', 'otpCode');

    // Drop otpExpiry column
    await queryRunner.dropColumn('users', 'otpExpiry');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate otpCode column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'otpCode',
        type: 'varchar',
        isNullable: true,
      })
    );

    // Recreate otpExpiry column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'otpExpiry',
        type: 'timestamp with time zone',
        isNullable: true,
      })
    );
  }
}
