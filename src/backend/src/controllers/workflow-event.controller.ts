import { Request, Response } from 'express';
import { WorkflowEventService } from '../services/workflow-event.service';

export class WorkflowEventController {
  /**
   * Get all workflow events (Admin)
   */
  static async getAllEvents(req: Request, res: Response) {
    try {
      const { limit } = req.query;
      const events = await WorkflowEventService.getAllEvents(
        limit ? parseInt(limit as string) : 100
      );
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get events by lead ID
   */
  static async getEventsByLead(req: Request, res: Response) {
    try {
      const { leadId } = req.params;
      const events = await WorkflowEventService.getEventsByLead(leadId);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
