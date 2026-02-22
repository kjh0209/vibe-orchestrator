import { Octokit } from '@octokit/rest';
import { Charter } from '@/lib/orchestrator/charter';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const owner = process.env.GITHUB_OWNER!;
    const repo = process.env.GITHUB_REPO!;

    // GitHub 레포 정보 가져오기
    const { data: repoData } = await octokit.repos.get({ owner, repo });

    const repoInfo = {
      name: repoData.name,
      description: repoData.description ?? '',
      topics: repoData.topics ?? [],
    };

    const charter = new Charter();
    const content = await charter.generate(repoInfo);
    const url = await charter.save(content);

    return NextResponse.json({ success: true, url, content });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
