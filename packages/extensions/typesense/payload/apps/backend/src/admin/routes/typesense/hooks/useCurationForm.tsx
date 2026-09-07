import type React from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import type {
  CurationFormData,
  CurationFormState,
  Override,
  OverrideRuleMatch,
  PreparedOverrideData,
  Product,
} from '../../../../modules/typesense/types';

export interface CurationFormResult {
  sanitizedId: string;
  overrideData: PreparedOverrideData;
}

export interface CurationFormHook {
  register: ReturnType<typeof useForm<CurationFormData>>['register'];
  control: ReturnType<typeof useForm<CurationFormData>>['control'];
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  reset: () => void;
  setValue: ReturnType<typeof useForm<CurationFormData>>['setValue'];
  getValues: ReturnType<typeof useForm<CurationFormData>>['getValues'];
  formState: CurationFormState;
  updateFormState: (key: keyof CurationFormState, value: boolean) => void;
  selectedProducts: Product[];
  setSelectedProducts: (products: Product[]) => void;
  excludedProducts: Product[];
  setExcludedProducts: (products: Product[]) => void;
  queryRuleMatch: OverrideRuleMatch;
  setQueryRuleMatch: (match: OverrideRuleMatch) => void;
  loadOverrideForEdit: (override: Override) => void;
  addSelectedProduct: (product: Product) => void;
  removeSelectedProduct: (productId: string) => void;
  addExcludedProduct: (product: Product) => void;
  removeExcludedProduct: (productId: string) => void;
  useEffectiveFrom: boolean;
  setUseEffectiveFrom: (value: boolean) => void;
  useEffectiveTo: boolean;
  setUseEffectiveTo: (value: boolean) => void;
  errors: ReturnType<typeof useForm<CurationFormData>>['formState']['errors'];
  rulesError: string | null;
}

export const useCurationForm = (
  onSubmitCallback: (data: CurationFormResult) => void
): CurationFormHook => {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CurationFormData>({
    defaultValues: {
      id: '',
      query: '',
      filter_by: '',
      tags: '',
      includes: [],
      excludes: [],
      filter_documents: '',
      sort_by: '',
      replace_query: '',
      custom_metadata: '',
      effective_from: '',
      effective_to: '',
      match: 'exact',
    },
  });

  const [formState, setFormState] = useState<CurationFormState>({
    useQueryRule: false,
    useFilterRule: false,
    useTagsRule: false,
    useFilterDocuments: false,
    useSortDocuments: false,
    useReplaceQuery: false,
    useRemoveMatchedTokens: false,
    useApplyFilters: false,
    useCustomMetadata: false,
    useStopProcessing: false,
    useEffectiveFrom: false,
    useEffectiveTo: false,
    usePinDocuments: false,
    useHideDocuments: false,
  });

  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [excludedProducts, setExcludedProducts] = useState<Product[]>([]);
  const [queryRuleMatch, setQueryRuleMatch] = useState<OverrideRuleMatch>('exact');
  const [rulesError, setRulesError] = useState<string | null>(null);

  const updateFormState = (key: keyof CurationFormState, value: boolean) => {
    setFormState((prevState) => ({ ...prevState, [key]: value }));
  };

  const addSelectedProduct = (product: Product) => {
    setSelectedProducts((prev) => {
      if (prev.find((p) => p.id === product.id)) {
        return prev;
      }
      return [...prev, product];
    });
  };

  const removeSelectedProduct = (productId: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const addExcludedProduct = (product: Product) => {
    setExcludedProducts((prev) => {
      if (prev.find((p) => p.id === product.id)) {
        return prev;
      }
      return [...prev, product];
    });
  };

  const removeExcludedProduct = (productId: string) => {
    setExcludedProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const prepareFormData = (data: CurationFormData): CurationFormResult => {
    const sanitizedId = data.id.trim();

    const overrideData: PreparedOverrideData = {
      rule: {},
      remove_matched_tokens: false,
      filter_curated_hits: false,
      stop_processing: false,
    };

    const actions: { metadata?: Record<string, unknown> } = { metadata: {} };

    if (formState.useQueryRule && data.query?.trim()) {
      overrideData.rule.query = data.query.trim();
      overrideData.rule.match = queryRuleMatch;
    }

    if (formState.useFilterRule && data.filter_by?.trim()) {
      overrideData.rule.filter_by = data.filter_by.trim();
    }

    if (formState.useTagsRule && data.tags?.trim()) {
      const tagsArray = data.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      if (tagsArray.length > 0) {
        overrideData.rule.tags = tagsArray;
      }
    }

    if (formState.useFilterDocuments && data.filter_documents?.trim()) {
      overrideData.filter_by = data.filter_documents.trim();
    }

    if (formState.useSortDocuments && data.sort_by?.trim()) {
      overrideData.sort_by = data.sort_by.trim();
    }

    if (formState.useReplaceQuery && data.replace_query?.trim()) {
      overrideData.replace_query = data.replace_query.trim();
    }

    overrideData.remove_matched_tokens = formState.useRemoveMatchedTokens;
    overrideData.filter_curated_hits = formState.useApplyFilters;
    overrideData.stop_processing = formState.useStopProcessing;

    if (formState.useCustomMetadata && data.custom_metadata?.trim()) {
      try {
        actions.metadata = JSON.parse(data.custom_metadata);
      } catch (error) {
        console.error('Invalid JSON in custom metadata:', error);
        actions.metadata = { raw: data.custom_metadata };
      }
    }

    if (formState.usePinDocuments && selectedProducts.length > 0) {
      overrideData.includes = selectedProducts.map((product, index) => ({
        id: product.id,
        position: index + 1,
      }));
    }

    if (formState.useHideDocuments && excludedProducts.length > 0) {
      overrideData.excludes = excludedProducts.map((product) => ({ id: product.id }));
    }

    if (formState.useEffectiveFrom && data.effective_from) {
      overrideData.effective_from_ts = Math.floor(new Date(data.effective_from).getTime() / 1000);
    }

    if (formState.useEffectiveTo && data.effective_to) {
      overrideData.effective_to_ts = Math.floor(new Date(data.effective_to).getTime() / 1000);
    }

    if (Object.keys(actions).length > 0) {
      overrideData.actions = actions;
    }

    return { sanitizedId, overrideData };
  };

  const loadOverrideForEdit = (override: Override) => {
    if (!override) {
      return;
    }

    reset();

    setTimeout(() => {
      setValue('id', override.id);

      if (override.rule) {
        if (override.rule.query) {
          setValue('query', override.rule.query);
          updateFormState('useQueryRule', true);
          if (
            override.rule.match &&
            (override.rule.match === 'exact' || override.rule.match === 'contains')
          ) {
            setQueryRuleMatch(override.rule.match);
          }
        }

        if (override.rule.filter_by) {
          setValue('filter_by', override.rule.filter_by);
          updateFormState('useFilterRule', true);
        }

        if (override.rule.tags && override.rule.tags.length > 0) {
          setValue('tags', override.rule.tags.join(', '));
          updateFormState('useTagsRule', true);
        }
      }

      if (override.filter_by) {
        setValue('filter_documents', override.filter_by);
        updateFormState('useFilterDocuments', true);
      }

      if (override.sort_by) {
        setValue('sort_by', override.sort_by);
        updateFormState('useSortDocuments', true);
      }

      if (override.replace_query) {
        setValue('replace_query', override.replace_query);
        updateFormState('useReplaceQuery', true);
      }

      if (override.remove_matched_tokens) {
        updateFormState('useRemoveMatchedTokens', true);
      }

      if (override.filter_curated_hits) {
        updateFormState('useApplyFilters', true);
      }

      if (override.stop_processing) {
        updateFormState('useStopProcessing', true);
      }

      if (override.actions?.metadata) {
        setValue('custom_metadata', JSON.stringify(override.actions.metadata, null, 2));
        updateFormState('useCustomMetadata', true);
      }

      if (override.includes && override.includes.length > 0) {
        updateFormState('usePinDocuments', true);
      }

      if (override.excludes && override.excludes.length > 0) {
        updateFormState('useHideDocuments', true);
      }

      if (override.effective_from_ts) {
        const date = new Date(override.effective_from_ts * 1000);
        setValue('effective_from', date.toISOString().slice(0, 16));
        updateFormState('useEffectiveFrom', true);
      }

      if (override.effective_to_ts) {
        const date = new Date(override.effective_to_ts * 1000);
        setValue('effective_to', date.toISOString().slice(0, 16));
        updateFormState('useEffectiveTo', true);
      }
    }, 100);
  };

  const onSubmit = (data: CurationFormData) => {
    setRulesError(null);

    const hasQueryRule = formState.useQueryRule && data.query.trim();
    const hasFilterRule = formState.useFilterRule && data.filter_by.trim();
    const hasTagsRule = formState.useTagsRule && data.tags.trim();

    if (!hasQueryRule && !hasFilterRule && !hasTagsRule) {
      setRulesError(
        'At least one rule (Query, Filter, or Tags) must be selected and filled with a value.'
      );
      return;
    }

    const result = prepareFormData(data);
    onSubmitCallback(result);
  };

  const resetAll = () => {
    reset();
    setFormState({
      useQueryRule: false,
      useFilterRule: false,
      useTagsRule: false,
      useFilterDocuments: false,
      useSortDocuments: false,
      useReplaceQuery: false,
      useRemoveMatchedTokens: false,
      useApplyFilters: false,
      useCustomMetadata: false,
      useStopProcessing: false,
      useEffectiveFrom: false,
      useEffectiveTo: false,
      usePinDocuments: false,
      useHideDocuments: false,
    });
    setSelectedProducts([]);
    setExcludedProducts([]);
    setQueryRuleMatch('exact');
    setRulesError(null);
  };

  return {
    register,
    control,
    handleSubmit: handleSubmit(onSubmit),
    reset: resetAll,
    setValue,
    getValues,
    formState,
    updateFormState,
    selectedProducts,
    setSelectedProducts,
    excludedProducts,
    setExcludedProducts,
    queryRuleMatch,
    setQueryRuleMatch,
    loadOverrideForEdit,
    addSelectedProduct,
    removeSelectedProduct,
    addExcludedProduct,
    removeExcludedProduct,
    useEffectiveFrom: formState.useEffectiveFrom,
    setUseEffectiveFrom: (value: boolean) => updateFormState('useEffectiveFrom', value),
    useEffectiveTo: formState.useEffectiveTo,
    setUseEffectiveTo: (value: boolean) => updateFormState('useEffectiveTo', value),
    errors,
    rulesError,
  };
};
