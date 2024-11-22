import { jsonRes } from '@fastgpt/service/common/response';
import type { NextApiRequest, NextApiResponse } from 'next';
import { addUser } from '@/service/mongo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    addUser('abcd');
  } catch (err) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}
