import { Request, Response } from 'express';
import { BuyerService } from '../services/buyer.service';
import { KeywordIntentParser } from '../parsers/intent-parser';

const intentParser = new KeywordIntentParser();

export class BuyerController {
    /**
     * Create a new buyer
     */
    static async createBuyer(req: Request, res: Response) {
        try {
            const {
                name,
                email,
                phone,
                localities,
                areaMin,
                areaMax,
                bhk,
                budgetMin,
                budgetMax,
                minBudget,
                maxBudget,
                amenities,
                rawPreferences,
                metadata,
            } = req.body;

            // If raw preferences are provided, parse them
            let parsedIntent;
            if (rawPreferences) {
                parsedIntent = intentParser.parse(rawPreferences);
            }

            const buyer = await BuyerService.createBuyer({
                name,
                email,
                phone,
                areaMin: areaMin || parsedIntent?.areaMin,
                areaMax: areaMax || parsedIntent?.areaMax,
                bhk: bhk || parsedIntent?.bhk,
                budgetMin: budgetMin ?? minBudget ?? parsedIntent?.budgetMin,
                budgetMax: budgetMax ?? maxBudget ?? parsedIntent?.budgetMax,
                amenities: amenities || parsedIntent?.amenities || [],
                rawPreferences,
                metadata,
            });

            res.status(201).json(buyer);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Get buyer by ID
     */
    static async getBuyerById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const buyer = await BuyerService.getBuyerById(id);

            if (!buyer) {
                return res.status(404).json({ error: 'Buyer not found' });
            }

            res.json(buyer);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get all buyers
     */
    static async getAllBuyers(req: Request, res: Response) {
        try {
            const { bhk, limit } = req.query;

            const buyers = await BuyerService.getAllBuyers({
                bhk: bhk ? parseInt(bhk as string) : undefined,
                limit: limit ? parseInt(limit as string) : undefined,
            });

            res.json(buyers);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Update buyer
     */
    static async updateBuyer(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { rawPreferences } = req.body;

            let updateData = { ...req.body } as Record<string, any>;
            if (updateData.minBudget !== undefined && updateData.budgetMin === undefined) {
                updateData.budgetMin = updateData.minBudget;
            }
            if (updateData.maxBudget !== undefined && updateData.budgetMax === undefined) {
                updateData.budgetMax = updateData.maxBudget;
            }
            delete updateData.minBudget;
            delete updateData.maxBudget;

            // If raw preferences are updated, re-parse them
            if (rawPreferences) {
                const parsedIntent = intentParser.parse(rawPreferences);

                // Replace all parsed fields from the new intent (always overwrite)
                // This ensures that parameters NOT mentioned in the current query (like BHK or amenities)
                // are set to null/empty in the database, rather than keeping the old values.
                updateData = {
                    areaMin: parsedIntent.areaMin ?? null,
                    areaMax: parsedIntent.areaMax ?? null,
                    bhk: parsedIntent.bhk ?? null,
                    budgetMin: parsedIntent.budgetMin ?? null,
                    budgetMax: parsedIntent.budgetMax ?? null,
                    amenities: parsedIntent.amenities,
                    ...updateData, // Explicit fields in req.body take precedence
                };

                // Clean up undefineds to avoid overwriting existing data with nulls if we don't want to
                // But here we want to update.
            }

            const buyer = await BuyerService.updateBuyer(id, updateData);
            res.json(buyer);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Delete buyer
     */
    static async deleteBuyer(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await BuyerService.deleteBuyer(id);
            res.status(204).send();
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}
