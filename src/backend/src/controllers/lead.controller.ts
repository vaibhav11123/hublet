import { Request, Response } from 'express';
import { LeadService } from '../services/lead.service';
import { LeadState } from '../workflows/state-machine';

export class LeadController {
  /**
   * Create a new lead
   */
  static async createLead(req: Request, res: Response) {
    try {
      const { buyerId, propertyId, matchScore, metadata } = req.body;

      const lead = await LeadService.createLead({
        buyerId,
        propertyId,
        matchScore,
        metadata,
      });

      res.status(201).json(lead);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get lead by ID
   */
  static async getLeadById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const lead = await LeadService.getLeadById(id);

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      res.json(lead);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all leads
   */
  static async getAllLeads(req: Request, res: Response) {
    try {
      const { buyerId, propertyId, state, minMatchScore, limit } = req.query;
      const currentUser = req.user;

      const effectiveBuyerId = currentUser?.role === 'buyer'
        ? currentUser.userId
        : (buyerId as string | undefined);

      const effectiveSellerId = currentUser?.role === 'seller'
        ? currentUser.userId
        : undefined;

      const leads = await LeadService.getAllLeads({
        buyerId: effectiveBuyerId,
        sellerId: effectiveSellerId,
        propertyId: propertyId as string,
        state: state as LeadState,
        minMatchScore: minMatchScore ? parseFloat(minMatchScore as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json(leads);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Transition lead state
   */
  static async transitionState(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { toState } = req.body;

      if (!toState || !Object.values(LeadState).includes(toState)) {
        return res.status(400).json({ error: 'Invalid state provided' });
      }

      const lead = await LeadService.transitionState(id, toState);
      res.json(lead);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get allowed next states for a lead
   */
  static async getAllowedNextStates(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const allowedStates = await LeadService.getAllowedNextStates(id);
      res.json({ allowedStates });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
