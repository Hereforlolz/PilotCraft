export interface AISuitability {
  rating: 'strong' | 'conditional' | 'poor';
  rationale: string;
}

export interface FutureWorkflowStep {
  step: string;
  humanRole: string;
  aiRole: string;
}

export interface ResponsibilitySplit {
  human: string[];
  ai: string[];
}

export interface Stakeholder {
  role: string;
  impact: string;
  involvement: string;
}

export interface AdoptionBarrier {
  barrier: string;
  mitigation: string;
}

export interface TrainingAndCommunication {
  trainingActions: string[];
  communicationActions: string[];
}

export interface Risk {
  risk: string;
  severity: 'low' | 'medium' | 'high';
  safeguard: string;
  humanReview: string;
}

export interface PilotPlanStep {
  period: string;
  actions: string[];
  suggestedOwner: string;
  evidenceToCollect: string[];
}

export interface SuccessMetric {
  metric: string;
  baseline: string;
  proposedTarget: string;
  collectionMethod: string;
}

export interface DecisionCriteria {
  stop: string[];
  revise: string[];
  scale: string[];
}

export interface EvidenceCheck {
  userProvidedFacts: string[];
  assumptions: string[];
  missingEvidence: string[];
}

export interface ReadinessScore {
  score: number;
  explanation: string;
  factorsReducingScore: string[];
}

export interface AnalysisReport {
  problemStatement: string;
  clarifyingQuestions: string[];
  aiSuitability: AISuitability;
  futureWorkflow: FutureWorkflowStep[];
  responsibilitySplit: ResponsibilitySplit;
  stakeholders: Stakeholder[];
  adoptionBarriers: AdoptionBarrier[];
  trainingAndCommunication: TrainingAndCommunication;
  risks: Risk[];
  pilotPlan: PilotPlanStep[];
  successMetrics: SuccessMetric[];
  decisionCriteria: DecisionCriteria;
  evidenceCheck: EvidenceCheck;
  readinessScore: ReadinessScore;
}
