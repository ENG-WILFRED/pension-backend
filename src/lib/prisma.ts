// Compatibility wrapper to minimize changes: expose a `prisma`-like API backed by TypeORM
import AppDataSource from './data-source';
import { User } from '@/entities/User';
import { Transaction } from '@/entities/Transaction';

async function ensureInitialized() {
	if (!AppDataSource.isInitialized) {
		await AppDataSource.initialize();
	}
}

type Maybe<T> = T | null;

export default {
	user: {
		async findUnique({ where }: any): Promise<Maybe<User>> {
			await ensureInitialized();
			if (where && where.email) return AppDataSource.getRepository(User).findOneBy({ email: where.email });
			if (where && where.id) return AppDataSource.getRepository(User).findOneBy({ id: where.id });
			return null;
		},
		async create({ data }: any): Promise<User> {
			await ensureInitialized();
			const repo = AppDataSource.getRepository(User);
			const u = repo.create(data);
			return (repo.save(u) as unknown) as Promise<User>;
		},
		async findMany({ where }: any = {}): Promise<User[]> {
			await ensureInitialized();
			return AppDataSource.getRepository(User).find({ where: where || {} } as any);
		},
	},
	transaction: {
		async create({ data }: any): Promise<Transaction> {
			await ensureInitialized();
			const repo = AppDataSource.getRepository(Transaction);
			const t = repo.create(data);
			return (repo.save(t) as unknown) as Promise<Transaction>;
		},
		async findUnique({ where }: any): Promise<Maybe<Transaction>> {
			await ensureInitialized();
			if (!where) return null;
			return AppDataSource.getRepository(Transaction).findOneBy(where as any);
		},
		async findMany({ where }: any = {}): Promise<Transaction[]> {
			await ensureInitialized();
			return AppDataSource.getRepository(Transaction).find({ where: where || {} } as any);
		},
		async update({ where, data }: any): Promise<Maybe<Transaction>> {
			await ensureInitialized();
			const repo = AppDataSource.getRepository(Transaction);
			await repo.update(where, data);
			return repo.findOneBy(where as any);
		},
	},
};
