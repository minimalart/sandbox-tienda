export {
  RecommendationRelation,
  RELATION_TYPES,
  RELATION_ORIGINS,
  GLOBAL_SOURCE_PRODUCT_ID,
} from './recommendation-relation';
export type { RelationType, RelationOrigin } from './recommendation-relation';

export {
  RecommendationStrategy,
  STRATEGY_KINDS,
  STRATEGY_CADENCES,
} from './recommendation-strategy';
export type { StrategyKind, StrategyCadence } from './recommendation-strategy';

export { RecommendationPlacement, PLACEMENT_KEYS } from './recommendation-placement';
export type { PlacementKey } from './recommendation-placement';

export {
  RecommendationVersion,
  VERSION_STATUSES,
  VERSION_TRIGGERS,
} from './recommendation-version';
export type { VersionStatus, VersionTrigger } from './recommendation-version';

export {
  RecommendationEvent,
  RECOMMENDATION_EVENTS,
  ATTRIBUTION_KINDS,
} from './recommendation-event';
export type { RecommendationEventType, AttributionKind } from './recommendation-event';

export { RecommendationMetric, METRIC_BUCKETS } from './recommendation-metric';
export type { MetricBucket } from './recommendation-metric';
