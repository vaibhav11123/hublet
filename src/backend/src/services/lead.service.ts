import prisma from '../db/prisma';
import { LeadState, LeadStateMachine } from '../workflows/state-machine';
import { WorkflowEventService } from './workflow-event.service';

// Defined locally as they are missing from Prisma Client in this setup
export enum EventType {
    LEAD_CREATED = 'LEAD_CREATED',
    STATE_TRANSITION = 'STATE_TRANSITION',
    MATCH_GENERATED = 'MATCH_GENERATED',
    ERROR = 'ERROR',
    INVALID_TRANSITION = 'INVALID_TRANSITION'
}

export class LeadService {
    /**
     * Create a new lead
     */
    static async createLead(data: {
        buyerId: string;
        propertyId: string;
        matchScore?: number;
        metadata?: any;
    }) {
        const lead = await prisma.lead.create({
            data: {
                buyerId: data.buyerId,
                propertyId: data.propertyId,
                state: LeadState.NEW,
                matchScore: data.matchScore,
                metadata: JSON.stringify(data.metadata || {}),
            },
            include: {
                buyer: true,
                property: {
                    include: {
                        seller: true,
                    },
                },
            },
        });

        // Log event
        await WorkflowEventService.logEvent({
            leadId: lead.id,
            eventType: EventType.LEAD_CREATED,
            toState: LeadState.NEW,
            description: `Lead created for buyer ${data.buyerId} and property ${data.propertyId}`,
        });

        return lead;
    }

    /**
     * Transition lead to a new state
     */
    static async transitionState(leadId: string, toState: LeadState) {
        // Get current lead
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
        });

        if (!lead) {
            throw new Error(`Lead ${leadId} not found`);
        }

        const fromState = lead.state as LeadState;

        // Validate transition
        try {
            LeadStateMachine.validateTransition(fromState, toState);
        } catch (error) {
            // Log invalid transition
            await WorkflowEventService.logEvent({
                leadId,
                eventType: EventType.INVALID_TRANSITION,
                fromState,
                toState,
                description: (error as Error).message,
            });
            throw error;
        }

        // Perform transition
        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: { state: toState },
            include: {
                buyer: true,
                property: {
                    include: {
                        seller: true,
                    },
                },
            },
        });

        // Log successful transition
        await WorkflowEventService.logEvent({
            leadId,
            eventType: EventType.STATE_TRANSITION,
            fromState,
            toState,
            description: `Lead transitioned from ${fromState} to ${toState}`,
        });

        return updatedLead;
    }

    /**
     * Get lead by ID
     */
    static async getLeadById(id: string) {
        return await prisma.lead.findUnique({
            where: { id },
            include: {
                buyer: true,
                property: {
                    include: {
                        seller: true,
                    },
                },
                events: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
    }

    /**
     * Get all leads with filters
     */
    static async getAllLeads(filters?: {
        buyerId?: string;
        sellerId?: string;
        propertyId?: string;
        state?: LeadState;
        minMatchScore?: number;
        limit?: number;
    }) {
        return await prisma.lead.findMany({
            where: {
                buyerId: filters?.buyerId,
                propertyId: filters?.propertyId,
                state: filters?.state,
                ...(filters?.sellerId && {
                    property: {
                        sellerId: filters.sellerId,
                    },
                }),
                ...(filters?.minMatchScore && {
                    matchScore: { gte: filters.minMatchScore },
                }),
            },
            include: {
                buyer: true,
                property: {
                    include: {
                        seller: true,
                    },
                },
            },
            take: filters?.limit || 100,
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Update lead metadata
     */
    static async updateLead(id: string, data: {
        matchScore?: number;
        metadata?: any;
    }) {
        return await prisma.lead.update({
            where: { id },
            data,
        });
    }

    /**
     * Get allowed next states for a lead
     */
    static async getAllowedNextStates(leadId: string): Promise<LeadState[]> {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
        });

        if (!lead) {
            throw new Error(`Lead ${leadId} not found`);
        }

        return LeadStateMachine.getAllowedNextStates(lead.state as LeadState);
    }
}
