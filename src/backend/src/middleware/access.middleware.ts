import { NextFunction, Request, Response } from 'express';
import prisma from '../db/prisma';

function getAuthenticatedUser(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return req.user;
}

export function requireBuyerSelfOrAdmin(paramKey = 'id') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getAuthenticatedUser(req, res);
    if (!user) return;

    if (user.role === 'admin') {
      return next();
    }

    if (user.role !== 'buyer') {
      return res.status(403).json({ error: 'Forbidden: buyer access required' });
    }

    const resourceBuyerId = req.params[paramKey];
    if (!resourceBuyerId || resourceBuyerId !== user.userId) {
      return res.status(403).json({ error: 'Forbidden: cannot access another buyer account' });
    }

    next();
  };
}

export function requireSellerSelfOrAdmin(paramKey = 'id') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getAuthenticatedUser(req, res);
    if (!user) return;

    if (user.role === 'admin') {
      return next();
    }

    if (user.role !== 'seller') {
      return res.status(403).json({ error: 'Forbidden: seller access required' });
    }

    const resourceSellerId = req.params[paramKey];
    if (!resourceSellerId || resourceSellerId !== user.userId) {
      return res.status(403).json({ error: 'Forbidden: cannot access another seller account' });
    }

    next();
  };
}

export function requirePropertyOwnerOrAdmin(paramKey = 'id') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = getAuthenticatedUser(req, res);
    if (!user) return;

    if (user.role === 'admin') {
      return next();
    }

    if (user.role !== 'seller') {
      return res.status(403).json({ error: 'Forbidden: seller access required' });
    }

    const propertyId = req.params[paramKey];
    if (!propertyId) {
      return res.status(400).json({ error: 'Property ID is required' });
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, sellerId: true },
    });

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    if (property.sellerId !== user.userId) {
      return res.status(403).json({ error: 'Forbidden: property does not belong to this seller' });
    }

    next();
  };
}

export async function requirePropertyCreateAccess(req: Request, res: Response, next: NextFunction) {
  const user = getAuthenticatedUser(req, res);
  if (!user) return;

  if (user.role === 'admin') {
    return next();
  }

  if (user.role !== 'seller') {
    return res.status(403).json({ error: 'Forbidden: seller access required' });
  }

  const sellerId = req.body?.sellerId;
  if (!sellerId) {
    return res.status(400).json({ error: 'sellerId is required' });
  }

  if (sellerId !== user.userId) {
    return res.status(403).json({ error: 'Forbidden: cannot create property for another seller' });
  }

  next();
}

export async function requireLeadCreateAccess(req: Request, res: Response, next: NextFunction) {
  const user = getAuthenticatedUser(req, res);
  if (!user) return;

  if (user.role === 'admin') {
    return next();
  }

  if (user.role === 'buyer') {
    const buyerId = req.body?.buyerId;
    if (!buyerId || buyerId !== user.userId) {
      return res.status(403).json({ error: 'Forbidden: buyer can only create own leads' });
    }
    return next();
  }

  if (user.role === 'seller') {
    const propertyId = req.body?.propertyId;
    if (!propertyId) {
      return res.status(400).json({ error: 'propertyId is required' });
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, sellerId: true },
    });

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    if (property.sellerId !== user.userId) {
      return res.status(403).json({ error: 'Forbidden: property does not belong to this seller' });
    }

    return next();
  }

  return res.status(403).json({ error: 'Forbidden' });
}

async function checkLeadAccessByLeadId(req: Request, res: Response, leadId: string) {
  const user = getAuthenticatedUser(req, res);
  if (!user) return false;

  if (user.role === 'admin') return true;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      buyerId: true,
      property: {
        select: {
          sellerId: true,
        },
      },
    },
  });

  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return false;
  }

  if (user.role === 'buyer' && lead.buyerId === user.userId) return true;
  if (user.role === 'seller' && lead.property.sellerId === user.userId) return true;

  res.status(403).json({ error: 'Forbidden: no access to this lead' });
  return false;
}

export function requireLeadAccess(paramKey = 'id') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const leadId = req.params[paramKey];
    if (!leadId) {
      return res.status(400).json({ error: 'Lead ID is required' });
    }

    const hasAccess = await checkLeadAccessByLeadId(req, res, leadId);
    if (!hasAccess) return;

    next();
  };
}

export function requireLeadEventsAccess(paramKey = 'leadId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const leadId = req.params[paramKey];
    if (!leadId) {
      return res.status(400).json({ error: 'Lead ID is required' });
    }

    const hasAccess = await checkLeadAccessByLeadId(req, res, leadId);
    if (!hasAccess) return;

    next();
  };
}
