import prisma from '../db/prisma';

export class WorkflowEventService {
  /**
   * Log a workflow event
   */
  static async logEvent(data: {
    leadId?: string;
    eventType: string;
    fromState?: string;
    toState?: string;
    description?: string;
    metadata?: any;
  }) {
    return await prisma.workflowEvent.create({
      data: {
        leadId: data.leadId,
        eventType: data.eventType,
        fromState: data.fromState,
        toState: data.toState,
        description: data.description,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });
  }

  /**
   * Get events for a lead
   */
  static async getLeadEvents(leadId: string) {
    return await prisma.workflowEvent.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all events with filters
   */
  static async getEvents(filters?: {
    eventType?: string;
    leadId?: string;
    limit?: number;
  }) {
    return await prisma.workflowEvent.findMany({
      where: {
        eventType: filters?.eventType,
        leadId: filters?.leadId,
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
    });
  }

  /**
   * Get all events (Admin)
   */
  static async getAllEvents(limit = 100) {
    return await prisma.workflowEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get events by lead ID
   */
  static async getEventsByLead(leadId: string) {
    return await prisma.workflowEvent.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
