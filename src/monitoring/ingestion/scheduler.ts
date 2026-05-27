import { prisma } from "@/lib/prisma";
import type { MonitoringSource } from "@/generated/prisma";

export interface ScheduledCheck {
  sourceId: string;
  tenantId: string;
  platform: string;
  name: string;
  lastCheckedAt: Date | null;
  checkInterval: number;
  overdueBy: number; // seconds overdue
}

export class MonitoringScheduler {
  /**
   * Query all active monitoring sources and determine which ones need
   * to be checked based on their checkInterval.
   * Returns sources sorted by how overdue they are (most overdue first).
   */
  async scheduleChecks(): Promise<ScheduledCheck[]> {
    const activeSources = await prisma.monitoringSource.findMany({
      where: { isActive: true },
      select: {
        id: true,
        tenantId: true,
        platform: true,
        name: true,
        lastCheckedAt: true,
        checkInterval: true,
      },
      orderBy: { lastCheckedAt: "asc" },
    });

    const now = Date.now();
    const overdue: ScheduledCheck[] = [];

    for (const source of activeSources) {
      const lastChecked = source.lastCheckedAt
        ? source.lastCheckedAt.getTime()
        : 0; // Never checked = immediately overdue
      const nextCheckAt = lastChecked + source.checkInterval * 1000;

      if (now >= nextCheckAt) {
        const overdueBy = Math.floor((now - nextCheckAt) / 1000);
        overdue.push({
          sourceId: source.id,
          tenantId: source.tenantId,
          platform: source.platform,
          name: source.name,
          lastCheckedAt: source.lastCheckedAt,
          checkInterval: source.checkInterval,
          overdueBy,
        });
      }
    }

    // Sort by most overdue first
    overdue.sort((a, b) => b.overdueBy - a.overdueBy);

    return overdue;
  }

  /**
   * Get the top N overdue checks that need to be processed.
   */
  async getOverdueChecks(limit: number = 10): Promise<ScheduledCheck[]> {
    const allChecks = await this.scheduleChecks();
    return allChecks.slice(0, limit);
  }

  /**
   * Update the lastCheckedAt timestamp for a source after a successful check.
   */
  async updateLastChecked(sourceId: string): Promise<void> {
    await prisma.monitoringSource.update({
      where: { id: sourceId },
      data: { lastCheckedAt: new Date() },
    });
  }

  /**
   * Get monitoring health overview: how many sources are active,
   * overdue, and recently checked.
   */
  async getHealthOverview(): Promise<{
    totalActive: number;
    overdue: number;
    recentlyChecked: number;
    neverChecked: number;
  }> {
    const activeSources = await prisma.monitoringSource.findMany({
      where: { isActive: true },
      select: {
        lastCheckedAt: true,
        checkInterval: true,
      },
    });

    const now = Date.now();
    let overdue = 0;
    let recentlyChecked = 0;
    let neverChecked = 0;

    for (const source of activeSources) {
      if (!source.lastCheckedAt) {
        neverChecked++;
        overdue++;
        continue;
      }

      const lastChecked = source.lastCheckedAt.getTime();
      const nextCheckAt = lastChecked + source.checkInterval * 1000;

      if (now >= nextCheckAt) {
        overdue++;
      }

      // "Recently checked" = within the last hour
      if (now - lastChecked < 3600 * 1000) {
        recentlyChecked++;
      }
    }

    return {
      totalActive: activeSources.length,
      overdue,
      recentlyChecked,
      neverChecked,
    };
  }
}
