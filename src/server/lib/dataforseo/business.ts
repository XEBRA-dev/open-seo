import { z } from "zod";
import {
  BusinessDataBusinessListingsSearchLiveRequestInfo,
  BusinessDataGoogleMyBusinessInfoLiveRequestInfo,
  BusinessDataGoogleQuestionsAndAnswersLiveRequestInfo,
  type BusinessDataBusinessListingsSearchLiveItem,
} from "dataforseo-client";
import { businessDataApi } from "@/server/lib/dataforseo/core";
import {
  assertOk,
  buildTaskBilling,
  type DataforseoApiResponse,
} from "@/server/lib/dataforseo/envelope";

type BusinessListingItem = BusinessDataBusinessListingsSearchLiveItem;

export async function fetchBusinessListingsSearch(input: {
  categories?: string[];
  title?: string;
  locationCoordinate: string;
  orderBy?: string[];
  limit: number;
}): Promise<DataforseoApiResponse<BusinessListingItem[]>> {
  const response = await businessDataApi().businessListingsSearchLive([
    new BusinessDataBusinessListingsSearchLiveRequestInfo({
      categories: input.categories,
      title: input.title,
      location_coordinate: input.locationCoordinate,
      order_by: input.orderBy,
      limit: input.limit,
    }),
  ]);
  // "No Search Results" (40501) is a valid empty result for obscure
  // businesses/keywords — DataForSEO still charges for it, so treat it as an
  // empty success instead of surfacing a charged-task error to the user.
  const task = assertOk(response, { treatNoResultsAsEmpty: true });
  return {
    data: task.result?.[0]?.items ?? [],
    billing: buildTaskBilling(task),
  };
}

// Q&A results carry both answered (`items`) and unanswered
// (`items_without_answers`) rows; the SDK types this result as `any`, so we
// validate a generic record shape and flatten both.
const questionsResultSchema = z
  .object({
    items: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
    items_without_answers: z
      .array(z.record(z.string(), z.unknown()))
      .nullable()
      .optional(),
  })
  .passthrough();

function combinedQuestionItems(results: unknown): Record<string, unknown>[] {
  const list = Array.isArray(results) ? results : [];
  return list.flatMap((result) => {
    const parsed = questionsResultSchema.safeParse(result ?? {});
    if (!parsed.success) return [];
    return [
      ...(parsed.data.items ?? []),
      ...(parsed.data.items_without_answers ?? []),
    ];
  });
}

export async function fetchQuestionsAnswers(input: {
  keyword: string;
  locationCoordinate: string;
  languageCode: string;
  depth: number;
}): Promise<DataforseoApiResponse<Record<string, unknown>[]>> {
  const response = await businessDataApi().googleQuestionsAndAnswersLive([
    new BusinessDataGoogleQuestionsAndAnswersLiveRequestInfo({
      keyword: input.keyword,
      location_coordinate: input.locationCoordinate,
      language_code: input.languageCode,
      depth: input.depth,
    }),
  ]);
  // "No Search Results" (40501) is a valid empty result for obscure
  // businesses/keywords — DataForSEO still charges for it, so treat it as an
  // empty success instead of surfacing a charged-task error to the user.
  const task = assertOk(response, { treatNoResultsAsEmpty: true });
  return {
    data: combinedQuestionItems(task.result),
    billing: buildTaskBilling(task),
  };
}

// Google Business Profile. The SDK types the item as `any`, so validate the
// fields we actually read and let the rest pass through.
const myBusinessItemSchema = z
  .object({
    title: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    domain: z.string().nullable().optional(),
    is_claimed: z.boolean().nullable().optional(),
    rating: z
      .object({
        value: z.number().nullable().optional(),
        votes_count: z.number().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

type MyBusinessInfoItem = z.infer<typeof myBusinessItemSchema>;

/**
 * Look up one Google Business Profile by name (and optional location).
 *
 * Live, unlike the reviews endpoints, which are task-based — so this gives
 * rating and review counts synchronously without needing to store tasks.
 */
export async function fetchMyBusinessInfo(input: {
  keyword: string;
  locationName?: string;
  languageCode?: string;
}): Promise<DataforseoApiResponse<MyBusinessInfoItem[]>> {
  const response = await businessDataApi().googleMyBusinessInfoLive([
    new BusinessDataGoogleMyBusinessInfoLiveRequestInfo({
      keyword: input.keyword,
      ...(input.locationName ? { location_name: input.locationName } : {}),
      ...(input.languageCode ? { language_code: input.languageCode } : {}),
    }),
  ]);
  // A profile that does not exist is an empty result, not an error — but
  // DataForSEO still charges, so do not surface it as a failed task.
  const task = assertOk(response, { treatNoResultsAsEmpty: true });
  const items = task.result?.[0]?.items ?? [];
  return {
    data: items.flatMap((item: unknown) => {
      const parsed = myBusinessItemSchema.safeParse(item ?? {});
      return parsed.success ? [parsed.data] : [];
    }),
    billing: buildTaskBilling(task),
  };
}
