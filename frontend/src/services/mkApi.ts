/**
 * MK뉴스/MK증권 API 호출 서비스
 */

const MK_API_BASE_URL = 'https://mk-news-api-43vp3ey7fa-du.a.run.app/api';

export interface NewsSearchResponse {
  answer: string;
  sources: Array<{
    id: string;
    score: number;
    vectorScore: number;
    keywordScore: number;
    article: {
      id: string;
      art_id: string;
      title: string;
      body: string;
      summary: string;
      writers: string;
      service_daytime: string;
      category: string;
      article_url: string;
      image_urls: string[];
    };
    metadata: {
      company_names: string[];
      stock_codes: string[];
      keywords: string[];
    };
  }>;
  query: string;
}

export interface TVSearchResponse {
  answer: string;
  sources: Array<{
    id: string;
    score: number;
    vectorScore: number;
    keywordScore: number;
    tvSegment: {
      id: string;
      program_title: string;
      program_id: string;
      broadcast_date: string;
      start_t14: string;
      end_t14: string;
      segment_text: string;
      corrected_text: string;
      stock_codes: string[];
      start_time: string;
      end_time: string;
    };
  }>;
  query: string;
}

export interface ComprehensiveAnalysisResponse {
  success: boolean;
  stockName: string;
  analysis: {
    executiveSummary: string;
    companyOverview: {
      businessModel: string;
      majorProducts: string;
      marketPosition: string;
      recentDevelopments: string;
    };
    historicalAnalysis: {
      timeline: string;
      keyEvents: string;
      performanceHistory: string;
    };
    marketContext: {
      industryTrends: string;
      competitiveLandscape: string;
      regulatoryEnvironment: string;
    };
    financialAnalysis: {
      recentFinancials: string;
      keyMetrics: string;
      financialTrends: string;
    };
    strategicAnalysis: {
      businessStrategy: string;
      growthDrivers: string;
      riskFactors: string;
      opportunities: string;
    };
    mediaCoverage: {
      tvCoverage: string;
      newsCoverage: string;
      mediaSentiment: string;
    };
    detailedInsights: {
      technicalAnalysis: string;
      marketReaction: string;
      expertOpinions: string;
    };
    conclusion: string;
  };
  sources: {
    tv: Array<any>;
    news: Array<any>;
  };
  metadata: {
    tvSourcesCount: number;
    newsSourcesCount: number;
    generatedAt: string;
  };
}

/**
 * MK뉴스 검색 API 호출
 */
export async function searchMKNews(
  query: string,
  topK: number = 5,
  vectorWeight: number = 0.7
): Promise<NewsSearchResponse> {
  const response = await fetch(`${MK_API_BASE_URL}/rag/news/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      topK,
      vectorWeight,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

/**
 * MK증권 TV 검색 API 호출
 */
export async function searchMKTV(
  query: string,
  topK: number = 5,
  vectorWeight: number = 0.7
): Promise<TVSearchResponse> {
  const response = await fetch(`${MK_API_BASE_URL}/rag/tv/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      topK,
      vectorWeight,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

/**
 * 종목 종합 분석 API 호출
 */
export async function getComprehensiveAnalysis(
  stockName: string
): Promise<ComprehensiveAnalysisResponse> {
  const response = await fetch(`${MK_API_BASE_URL}/tv/comprehensive-analysis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      stockName,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

