export interface EvalCase {
    id: string;
    description: string;
    entryText: string;
    user: {
        name: string;
        age?: number;
        occupation?: string;
        language: 'en' | 'ru';
    };
}

export const EVAL_CASES: EvalCase[] = [
    {
        id: 'en-short-win',
        description: 'Short English entry about a small success',
        entryText: 'I finally spoke up during the team meeting today. My hands were shaking, but afterward I felt proud and strangely calm.',
        user: {
            name: 'Maya',
            age: 29,
            occupation: 'Product designer',
            language: 'en'
        }
    },
    {
        id: 'en-long-transition',
        description: 'Long English entry about uncertainty and change',
        entryText: 'The offer arrived this morning, and I expected to feel only excited. Instead, I kept thinking about the people and routines I would leave behind. The new role could open doors I have wanted for years. It could also mean moving to a city where I know nobody. I noticed that I was asking everyone else what they would do instead of listening to myself. Tonight I want to sit with both the hope and the fear without forcing an answer.',
        user: {
            name: 'Daniel',
            age: 34,
            occupation: 'Software engineer',
            language: 'en'
        }
    },
    {
        id: 'en-grief',
        description: 'Emotionally heavy English entry about grief',
        entryText: 'I found one of Grandma\'s handwritten recipes while cleaning the kitchen. For a moment I could hear her correcting the way I chopped onions, and then the room felt painfully quiet. I miss her, but I am grateful that ordinary things still carry pieces of her.',
        user: {
            name: 'Elena',
            age: 41,
            occupation: 'Teacher',
            language: 'en'
        }
    },
    {
        id: 'en-conflict',
        description: 'English entry about anger after a friendship conflict',
        entryText: 'Sam cancelled again and acted as if it was no big deal. I sent a sharp reply, then spent the afternoon feeling guilty about it. I am angry because my time matters, but I also wish I had said that without trying to hurt him.',
        user: {
            name: 'Jordan',
            occupation: 'Nurse',
            language: 'en'
        }
    },
    {
        id: 'en-near-empty',
        description: 'Near-empty English entry with little context',
        entryText: 'Tired. That is all.',
        user: {
            name: 'Alex',
            language: 'en'
        }
    },
    {
        id: 'en-gibberish',
        description: 'Mostly gibberish entry that should not invite overinterpretation',
        entryText: 'Blorpt snavi krell, maybe Tuesday wobble zint. Frum frum, keys went qqqwrr and my brain said splonk.',
        user: {
            name: 'Riley',
            age: 25,
            language: 'en'
        }
    },
    {
        id: 'ru-burnout',
        description: 'Russian entry about exhaustion and work pressure',
        entryText: 'Сегодня я снова закрыл ноутбук только после полуночи. Весь день отвечал на чужие срочные просьбы, а до своей важной задачи так и не дошёл. Я злюсь на коллег, но понимаю, что сам каждый раз соглашаюсь помочь. Кажется, мне страшно разочаровать людей, даже когда сил уже нет.',
        user: {
            name: 'Илья',
            age: 32,
            occupation: 'Маркетолог',
            language: 'ru'
        }
    },
    {
        id: 'ru-joy',
        description: 'Russian entry about a quiet joyful experience',
        entryText: 'Утром мы с дочкой впервые катались на велосипедах вдоль реки. Она всё время смеялась и гордо ехала впереди меня. Я поймала себя на мысли, что давно никуда не спешила и просто была рядом. Хочу чаще замечать такие спокойные счастливые часы.',
        user: {
            name: 'Анна',
            age: 38,
            occupation: 'Архитектор',
            language: 'ru'
        }
    },
    {
        id: 'ru-self-doubt',
        description: 'Russian entry about creative self-doubt',
        entryText: 'Сегодня показал редактору первые главы и весь разговор ждал критики. Она сказала много хорошего, но я запомнил только одно замечание о слабом финале. Теперь хочется всё бросить, хотя утром я ещё верил в эту книгу. Почему один недостаток для меня громче всего, что уже получилось?',
        user: {
            name: 'Максим',
            age: 27,
            occupation: 'Журналист',
            language: 'ru'
        }
    }
];
