import parse from 'csv-parse/lib/sync';
import fs from 'fs';
import path from 'path';
import { getRepository, getCustomRepository, In } from 'typeorm';

import uploadConfig from '../config/upload';

import Category from '../models/Category';
import Transaction from '../models/Transaction';
import TransactionRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class ImportTransactionsService {
  async execute(transactionFile: string): Promise<Transaction[]> {
    const categoriesRepository = getRepository(Category);
    const transactionsRepository = getCustomRepository(TransactionRepository);

    const filePath = path.join(uploadConfig.directory, transactionFile);
    const content = await fs.promises.readFile(filePath);

    const results = parse(content, { columns: true, trim: true });

    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(results.map((res: CSVTransaction) => res.category)),
      },
    });

    const existentCategoriesTitle = existentCategories.map(
      category => category.title,
    );

    const categoriesToAdd = results
      .map((res: CSVTransaction) => res.category)
      .filter((category: string) => !existentCategoriesTitle.includes(category))
      .filter(
        (value: string, index: number, self: string[]) =>
          self.indexOf(value) === index,
      );

    const newCategories = categoriesRepository.create(
      categoriesToAdd.map((category: string) => ({ title: category })),
    );

    await categoriesRepository.save(newCategories);

    const transactionCategories = [...existentCategories, ...newCategories];

    const transactions = transactionsRepository.create(
      results.map((transaction: CSVTransaction) => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: transactionCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(transactions);

    await fs.promises.unlink(filePath);

    return transactions;
  }
}

export default ImportTransactionsService;
