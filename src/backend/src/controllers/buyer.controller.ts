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

            // Preserve locality signal (explicit or free-text-derived) into metadata —
            // this is what feeds ensureGeocodedMetadata's geocoding and the admin/analytics reads.
            const localitiesList: string[] = Array.isArray(localities)
                ? localities
                : (localities ? [localities] : (parsedIntent?.localities || []));
            const mergedMetadata = localitiesList.length > 0
                ? { ...(metadata || {}), localities: localitiesList, localityText: (metadata && metadata.localityText) || localitiesList[0] }
                : metadata;

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
                metadata: mergedMetadata,
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
            const { rawPreferences, localities } = req.body;

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
            let parsedIntent;
            if (rawPreferences) {
                parsedIntent = intentParser.parse(rawPreferences);

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

            // Preserve locality signal (explicit or free-text-derived) into metadata,
            // mirroring createBuyer's merge — otherwise this update path silently drops
            // it, metadata.localityCoords never gets (re)geocoded, and the matcher's
            // hard location-score gate zeroes out every match for this buyer.
            const localitiesList: string[] = Array.isArray(localities)
                ? localities
                : (localities ? [localities] : (parsedIntent?.localities || []));
            if (localitiesList.length > 0) {
                // Merge onto the buyer's EXISTING stored metadata, not just
                // req.body.metadata (which is empty on a rawPreferences-only
                // update) — BuyerService.updateBuyer fully overwrites the
                // metadata column, so without this fetch, fields already on
                // the buyer (e.g. metadata.city) would be silently wiped by
                // every locality update. Found via live re-test: a buyer's
                // metadata.city disappeared after a rawPreferences-only
                // update, breaking city-based analytics for that buyer.
                const existingBuyer = await BuyerService.getBuyerById(id);
                const existingMetadata = existingBuyer?.metadata || {};
                updateData.metadata = {
                    ...existingMetadata,
                    ...(updateData.metadata || {}),
                    localities: localitiesList,
                    localityText: (updateData.metadata && updateData.metadata.localityText) || localitiesList[0],
                };
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
