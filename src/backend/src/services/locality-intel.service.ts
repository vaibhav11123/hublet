export async function getLocalityIntel(locality: string): Promise<string | null> {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) return null;

    try {
        const res = await fetch('https://api.exa.ai/answer', {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `In 2-3 concise sentences for a home buyer, summarize current real estate price trends, upcoming infrastructure projects, and connectivity for ${locality}, India.`,
                text: false,
            }),
        });

        if (!res.ok) return null;
        const data = await res.json() as { answer?: unknown };
        return typeof data.answer === 'string' ? data.answer : null;
    } catch {
        return null;
    }
}
