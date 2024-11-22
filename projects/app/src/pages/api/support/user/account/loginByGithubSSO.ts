import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { createJWT, setCookie } from '@fastgpt/service/support/permission/controller';
import { getUserDetail } from '@fastgpt/service/support/user/controller';
import { addUser } from '@/service/mongo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const code = req.query['code'];
    const client_id = process.env.GITHUB_CLIENT_ID;
    const client_secret = process.env.GITHUB_SECRETS;
    if (!client_id || !client_secret || !code) {
      return res.status(400).json({ error: 'Github oauth parameters missing' });
    }

    // Step 1: Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json'
      },
      body: new URLSearchParams(
        `client_id=${client_id}&client_secret=${client_secret}&code=${code}`
      )
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error });
    }

    const { access_token } = tokenData;

    // Step 2: Fetch user information
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/json'
      }
    });

    const userData = await userResponse.json();

    // 首次登陆则创建用户，非首次则直接登录
    const username = userData.login;

    // 检测用户是否存在
    const authCert = await MongoUser.findOne(
      {
        username
      },
      'status'
    );

    if (!authCert) {
      try {
        // 首次认证则创建用户
        addUser(username);
      } catch (err) {
        throw new Error('用户不存在，添加用户异常');
      }
    }
    // 非首次认证则生成登录token
    const user = await MongoUser.findOne({
      username: username
    });
    const userDetail = await getUserDetail({
      tmbId: user?.lastLoginTmbId,
      userId: user._id
    });

    MongoUser.findByIdAndUpdate(user._id, {
      lastLoginTmbId: userDetail.team.tmbId
    });

    const token = createJWT({
      ...userDetail,
      isRoot: username === 'root'
    });

    setCookie(res, token);
    console.log('user login success', user?.username);
    res.redirect(307, '/app/list').end();
  } catch (err) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}
