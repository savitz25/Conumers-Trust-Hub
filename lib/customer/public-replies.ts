export type PublicBusinessReply={id:string;replyType:string;targetType:string;targetRecordId:string|null;body:string;source:'BUSINESS_RESPONSE';publishedAt:string;updatedAt:string|null};
export type PublicBusinessReplies={contractVersion:1;hub:'contractor';nativeProfileId:string;replies:PublicBusinessReply[]};
