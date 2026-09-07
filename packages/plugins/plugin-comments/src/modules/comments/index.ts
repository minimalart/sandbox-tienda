import { Module } from '@medusajs/framework/utils';
import CommentsModuleService from './service';

export const COMMENTS_MODULE = 'comments';

export default Module(COMMENTS_MODULE, {
  service: CommentsModuleService,
});
