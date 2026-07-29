// Lead State Machine
export enum LeadState {
  NEW = 'NEW',
  ENRICHED = 'ENRICHED',
  QUALIFIED = 'QUALIFIED',
  NOTIFIED = 'NOTIFIED',
  CONTACTED = 'CONTACTED',
  CLOSED = 'CLOSED',
}

// Valid transitions map
const VALID_TRANSITIONS: Record<LeadState, LeadState[]> = {
  [LeadState.NEW]: [LeadState.ENRICHED],
  [LeadState.ENRICHED]: [LeadState.QUALIFIED],
  [LeadState.QUALIFIED]: [LeadState.NOTIFIED],
  [LeadState.NOTIFIED]: [LeadState.CONTACTED],
  [LeadState.CONTACTED]: [LeadState.CLOSED],
  [LeadState.CLOSED]: [], // Terminal state
};

export class LeadStateMachine {
  /**
   * Check if a transition is valid
   */
  static isValidTransition(from: LeadState, to: LeadState): boolean {
    const allowedStates = VALID_TRANSITIONS[from];
    return allowedStates.includes(to);
  }

  /**
   * Get allowed next states
   */
  static getAllowedNextStates(currentState: LeadState): LeadState[] {
    return VALID_TRANSITIONS[currentState];
  }

  /**
   * Validate transition and throw error if invalid
   */
  static validateTransition(from: LeadState, to: LeadState): void {
    if (!this.isValidTransition(from, to)) {
      throw new Error(
        `Invalid state transition from ${from} to ${to}. Allowed transitions: ${VALID_TRANSITIONS[from].join(', ')}`
      );
    }
  }
}
