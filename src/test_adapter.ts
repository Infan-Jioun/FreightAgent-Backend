import { auth } from './lib/auth';

async function main() {
    const ctx = await (auth as any).$context;
    console.log('internalAdapter createSession:', typeof ctx.internalAdapter?.createSession);
    // Let's check prisma user
    const { prisma } = await import('./lib/prisma');
    const user = await prisma.user.findFirst();
    if (user) {
        const session = await ctx.internalAdapter.createSession(user.id);
        console.log('Created session object:', session);
        // clean up test session
        await prisma.session.delete({ where: { token: session.token } });
        console.log('Cleaned up test session successfully');
    }
}

main().catch(console.error);
