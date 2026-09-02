export type PublicBusinessReply={id:string;replyType:string;targetType:string;targetRecordId:string|null;body:string;source:'BUSINESS_RESPONSE';publishedAt:string;updatedAt:string|null};
export type PublicBusinessReplies={contractVersion:1|2;hub:import('./types.ts').CustomerHubId;nativeProfileId:string;replies:PublicBusinessReply[]};
