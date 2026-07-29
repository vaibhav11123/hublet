import { Request, Response } from 'express';
import { PropertyService } from '../services/property.service';
import { forwardGeocode, reverseGeocode as reverseGeocodeUtil } from '../utils/geocoder';
import { fetchNearbyPlaces } from '../utils/nearby-places';

export class PropertyController {
    /**
     * Create a new property
     */
    static async createProperty(req: Request, res: Response) {
        try {
            const {
                sellerId,
                title,
                description,
                locality,
                address,
                area,
                bhk,
                price,
                amenities,
                propertyType,
                contact,
                metadata,
            } = req.body;

            const property = await PropertyService.createProperty({
                sellerId,
                title,
                description,
                locality,
                address,
                area,
                bhk,
                price,
                amenities,
                propertyType,
                contact,
                metadata,
            });

            res.status(201).json(property);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Get property by ID
     */
    static async getPropertyById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const property = await PropertyService.getPropertyById(id);

            if (!property) {
                return res.status(404).json({ error: 'Property not found' });
            }

            res.json(property);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get all properties
     */
    static async getAllProperties(req: Request, res: Response) {
        try {
            const {
                locality,
                bhk,
                minPrice,
                maxPrice,
                minArea,
                maxArea,
                propertyType,
                isActive,
                limit,
            } = req.query;

            const properties = await PropertyService.getAllProperties({
                locality: locality as string,
                bhk: bhk ? parseInt(bhk as string) : undefined,
                minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
                maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
                minArea: minArea ? parseInt(minArea as string) : undefined,
                maxArea: maxArea ? parseInt(maxArea as string) : undefined,
                propertyType: propertyType as string,
                isActive: isActive ? isActive === 'true' : undefined,
                limit: limit ? parseInt(limit as string) : undefined,
            });

            res.json(properties);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get properties for map display (lightweight, only those with coordinates)
     */
    static async getPropertiesForMap(req: Request, res: Response) {
        try {
            const { bhk, minPrice, maxPrice, propertyType } = req.query;

            const properties = await PropertyService.getPropertiesForMap({
                bhk: bhk ? parseInt(bhk as string) : undefined,
                minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
                maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
                propertyType: propertyType as string,
            });

            res.json(properties);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Reverse geocode coordinates to address/locality
     */
    static async reverseGeocode(req: Request, res: Response) {
        try {
            const { lat, lon } = req.query;
            if (!lat || !lon) {
                return res.status(400).json({ error: 'lat and lon query parameters are required' });
            }

            const result = await reverseGeocodeUtil(parseFloat(lat as string), parseFloat(lon as string));
            if (!result) {
                return res.status(404).json({ error: 'Could not reverse geocode the given coordinates' });
            }

            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Forward geocode: query string → coordinates + address/locality
     * GET /api/properties/geocode?query=
     */
    static async geocode(req: Request, res: Response) {
        try {
            const { query } = req.query;
            if (!query) {
                return res.status(400).json({ error: 'query parameter is required' });
            }

            const result = await forwardGeocode(query as string);
            if (!result) {
                return res.status(404).json({ error: 'Could not geocode the given query' });
            }

            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get nearby places (airport, bus, train, hospital) for given coordinates.
     * GET /api/properties/nearby-places?lat=&lon=
     */
    static async getNearbyPlaces(req: Request, res: Response) {
        try {
            const { lat, lon } = req.query;
            if (!lat || !lon) {
                return res.status(400).json({ error: 'lat and lon query parameters are required' });
            }
            const result = await fetchNearbyPlaces(parseFloat(lat as string), parseFloat(lon as string));
            res.json(result);
        } catch (error: any) {
            const message = error?.message || 'Nearby places lookup failed';
            res.status(200).json({ fetchedAt: new Date().toISOString(), stale: true, error: message });
        }
    }

    /**
     * Update property
     */
    static async updateProperty(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const property = await PropertyService.updateProperty(id, req.body);
            res.json(property);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Delete property
     */
    static async deleteProperty(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await PropertyService.deleteProperty(id);
            res.status(204).send();
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Mark property as sold
     */
    static async markPropertyAsSold(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const existing = await PropertyService.getPropertyById(id);
            if (!existing) {
                return res.status(404).json({ error: 'Property not found' });
            }
            const mergedMetadata = { ...(existing.metadata || {}), markedAsSold: true };
            const property = await PropertyService.updateProperty(id, { isActive: false, metadata: mergedMetadata });
            res.json({ success: true, property });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}
