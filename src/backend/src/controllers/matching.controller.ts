import { Request, Response } from 'express';
import { MatchingService } from '../services/matching.service';

const matchingService = new MatchingService();

export class MatchingController {
  /**
   * Find matches for a buyer
   */
  static async findMatchesForBuyer(req: Request, res: Response) {
    try {
      const { buyerId } = req.params;
      const { minScore, limit } = req.query;

      const matches = await matchingService.findMatchesForBuyer(buyerId, {
        minScore: minScore ? parseFloat(minScore as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json(matches);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Find matches for a property
   */
  static async findMatchesForProperty(req: Request, res: Response) {
    try {
      const { propertyId } = req.params;
      const { minScore, limit } = req.query;

      const matches = await matchingService.findMatchesForProperty(propertyId, {
        minScore: minScore ? parseFloat(minScore as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json(matches);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get existing matches for a buyer
   */
  static async getMatchesForBuyer(req: Request, res: Response) {
    try {
      const { buyerId } = req.params;
      const matches = await matchingService.getMatchesForBuyer(buyerId);
      res.json(matches);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get existing matches for a property
   */
  static async getMatchesForProperty(req: Request, res: Response) {
    try {
      const { propertyId } = req.params;
      const matches = await matchingService.getMatchesForProperty(propertyId);
      res.json(matches);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all matches (Admin)
   */
  static async getAllMatches(req: Request, res: Response) {
    try {
      const matches = await matchingService.getAllMatches();
      res.json(matches);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
