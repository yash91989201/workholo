// AUTO-GENERATED FILE. DO NOT EDIT.
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import {
  campaign,
  campaignLeadList,
  campaignNumber,
} from "../../schema/campaigns";

export const CampaignModelSchema = createSelectSchema(campaign);
export const CampaignInsertSchema = createInsertSchema(campaign);
export const CampaignUpdateSchema = createUpdateSchema(campaign);

export const CampaignLeadListModelSchema = createSelectSchema(campaignLeadList);
export const CampaignLeadListInsertSchema =
  createInsertSchema(campaignLeadList);
export const CampaignLeadListUpdateSchema =
  createUpdateSchema(campaignLeadList);

export const CampaignNumberModelSchema = createSelectSchema(campaignNumber);
export const CampaignNumberInsertSchema = createInsertSchema(campaignNumber);
export const CampaignNumberUpdateSchema = createUpdateSchema(campaignNumber);
