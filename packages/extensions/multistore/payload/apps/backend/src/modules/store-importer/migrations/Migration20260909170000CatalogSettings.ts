import { Migration } from '@mikro-orm/migrations';

import { catalogSettingsMigrationSql } from '../settings-migration';

export class Migration20260909170000CatalogSettings extends Migration {
  override async up(): Promise<void> {
    this.addSql(catalogSettingsMigrationSql);
  }

  override async down(): Promise<void> {
    // Copia aditiva: el namespace original permanece y no se borran ajustes posteriores.
  }
}
