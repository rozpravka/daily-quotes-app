import express, { Express, Request, Response } from 'express';
import "reflect-metadata"
import { AppDataSource } from '../services/typeorm/data-source';
import { Author } from '../services/typeorm/entity/Author';
import { Quote } from '../services/typeorm/entity/Quote';
import { saveQuote, saveAuthor } from '../helper/helperFunctions';
import { register, httpRequestTimer, requestCounter } from '../services/monitoring/metrics';

export const router: Express = express();

router.use(express.json());

router.get('/metrics', async (_: Request, res: Response) => {
    try {
        res.setHeader('Content-Type', register.contentType);
        const metrics = await register.metrics();
        res.send(metrics);
    } catch (error) {
        res.sendStatus(500).send('Internal server error');
    }
  });

router.get('/', async (req: Request, res: Response) => {
    const start = Date.now();
    try {
        const queryQuote = await AppDataSource.getRepository(Quote).find({
            relations: ['author'],
            order: {
                generatedAt: 'DESC'
            },
            take: 1,
        });
        if (queryQuote.length === 0 || queryQuote[0] === undefined) {
            res.status(404).send('No quotes found');
            //console.log('No quotes found');
        } else {
            const quote: Quote = queryQuote[0];
            res.status(200).send(`Latest quote=> Author: ${quote.author.name}, content: ${quote.content}`);
            //console.log(`Latest quote=> Author: ${quote.author.name}, content: ${quote.content}`);
        }
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal server error');
    } finally {
        const responseTimeInMs = Date.now() - start;
        requestCounter.inc({ method: req.method })
        httpRequestTimer.labels(req.method, req.route.path, res.statusCode.toString()).observe(responseTimeInMs);
  }
});

router.post('/', async (req: Request, res: Response) => {
    const author: string = req.body.author;
    const quote: string  = req.body.quote;

    if (typeof author !== 'string' || typeof quote !== 'string') {
        console.log('Bad request');
        res.status(400).send('Bad request');
    }
    const start = Date.now();
    try {
        const queryAuthor = await AppDataSource.getRepository(Author).findOneBy({ name: author });
        if (queryAuthor === undefined || queryAuthor === null) {
            const newAuthor: Author | null = await saveAuthor(author);
            if (newAuthor !== null) await saveQuote(quote, newAuthor);
            res.send(`Quote: "${quote}" has been saved and author ${author} has been created.`);
        } else {
            await saveQuote(quote, queryAuthor);
            res.send(`Quote: "${quote}" by ${author} has been saved.`);
        }
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal server error');
    } finally {
        const responseTimeInMs = Date.now() - start;
        requestCounter.inc({ method: req.method })
        httpRequestTimer.labels(req.method, req.route.path, res.statusCode.toString()).observe(responseTimeInMs);
    }
});
