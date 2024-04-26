const express = require('express')
const app = express()
const port = 3002
const puppeteer = require('puppeteer-core');
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
const AUTH = 'brd-customer-hl_0d698af6-zone-scraping_browser:7qhc0i62zdnu';
const SBR_WS_ENDPOINT = `wss://${AUTH}@brd.superproxy.io:9222`;
const http = require('http');
const axios = require('axios-https-proxy-fix');
const cheerio = require('cheerio');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;


app.use(bodyParser.json());
app.use(cors());


const scrapeInfiniteScrollItems = async (page, itemTargetCount, parentId, elementClass) => {
  let items = [];

  if (itemTargetCount < 20) {
    items = await page.evaluate((className) => {
      const items = Array.from(document.querySelectorAll(`.${className}`));
      return items.map((item) => item.innerText);
    }, elementClass);
  } else {
    while (itemTargetCount > items.length) {
      console.log('ok');
      console.log(items);
      items = await page.evaluate((className) => {
        const items = Array.from(document.querySelectorAll(`.${className}`));
        return items.map((item) => item.innerText);
      }, elementClass);

      previousHeight = await page.evaluate((selector) => {
        const scrollableDiv = document.querySelector(selector);
        scrollableDiv.scrollTop = scrollableDiv.scrollHeight;
        return scrollableDiv.scrollHeight;
      }, parentId);

      await page.waitForFunction(
        (selector, previousHeight) => {
          const scrollableDiv = document.querySelector(selector);
          return scrollableDiv.scrollHeight > previousHeight;
        },
        { timeout: 0 },
        parentId,
        previousHeight
      );

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }



  return items;
};


const getParentId = async (page, childId) => {
  return await page.evaluate((childId) => {
    const childElement = document.getElementById("stubhub-event-detail-listings-grid");
    if (childElement) {
      var parentNode = childElement.parentElement;

      if (parentNode) {

        var className = parentNode.className.replace(/ /g, '.');

        return '.' + className;

      }
    }
    return null;

    // return null;
  }, childId);
};

app.post('/stubhubTickets', (req, res) => {
  const eventURL = req.body.url;
  (async () => {
    const browser = await puppeteer.launch({
      headless: false,
    });

    const page = await browser.newPage();
    await page.goto(`${eventURL}`);
    const xpathExpression = '//*[@id="stubhub-event-detail-listings-grid"]/div[2]/div/div[1]/div[2]/div[1]/div[1]/div[1]/div[1]';
    const countExpression = '//*[@id="stubhub-event-detail-listings-grid"]/div[1]/div/div[1]/div';

    const listingCount = await page.$x(countExpression);
    console.log(listingCount);
    const sectionName = await page.$x(xpathExpression);


    const listingCountClass = await listingCount[0].evaluate(element => {
      const classes = element.textContent;
      if (classes) {
        const classList = classes.split(' ');
        return classList[0]; // Return the first class
      }
      return null;
    });

    console.log(parseInt(listingCountClass));
    // Access the class attribute of the element
    const sectionNameClass = await sectionName[0].evaluate(element => {
      const classes = element.getAttribute('class');
      if (classes) {
        const classList = classes.split(' ');
        return classList[0]; // Return the first class
      }
      return null;
    });


    const parentId = await getParentId(page, "stubhub-event-detail-listings-grid");
    console.log(parentId);
    const items = await scrapeInfiniteScrollItems(page, parseInt(listingCountClass), parentId, sectionNameClass);
    // Use the class in your items query


    console.log(items);
    res.send({ parentId: parentId, items: items })




    // fs.writeFileSync("items.json", JSON.stringify(items));

    await browser.close();
  })();


});

app.get('/getEventBySearchStubHUb/:query', async (req, res) => {
  const query = req.params.query;
  const replacedString = query.replace(/ /g, "%20");

  const browser = await puppeteer.launch({
    headless: true,
  });

  const page = await browser.newPage();
  await page.goto(`https://www.stubhub.com/secure/search?q=${replacedString}&sellSearch=false`);
  try {

    await page.waitForTimeout(8000);

    //*[@id="app"]/div[1]/div[4]/div[2]/div[1]/div[1]/div/div[3]/div[1]/div[3]/ul
    const xpathExpression = '//*[@id="app"]/div[1]/div[4]/div[2]/div[1]/div[1]/div/div[3]/div[1]/div[3]/ul';

    var sectionName = await page.$x(xpathExpression); // Increased timeout to 60 seconds

    console.log(sectionName);
    if (sectionName.length == 0) {
      console.log('ok');
      sectionName = await page.$x(xpathExpression);
    }

    const sectionNameClass = await sectionName[0].evaluate(element => {
      const classes = element.getAttribute('class');
      if (classes) {
        const classList = classes.split(' ');
        return classes; // Return the first class
      }
      return null;
    });
    res.json(sectionNameClass)
    await browser.close();
  } catch (error) {

    console.error("Error while waiting for XPath:", error);
    const xpathExpression = '//*[@id="app"]/div[1]/div[4]/div[2]/div[1]/div[1]/div/div[3]/div[1]/div[3]/ul';

    var sectionName = await page.$x(xpathExpression); // Increased timeout to 60 seconds

    console.log(sectionName);
  }



  // const parentId = await getParentId(page, "stubhub-event-detail-listings-grid");

  //  const items = await scrapeInfiniteScrollItems(page, 1,"",sectionNameClass);
  // Use the class in your items query


  //  res.send({parentId:parentId , items:items})




  // fs.writeFileSync("items.json", JSON.stringify(items));

  // await browser.close();


});

app.get('/test2/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const replacedString = query.replace(/ /g, "%20");

    let sectionNames = [];
    do {
      const browser = await puppeteer.connect({
        browserWSEndpoint: SBR_WS_ENDPOINT,
      });
      const page = await browser.newPage();
      try {
        await page.goto(`https://www.stubhub.com/search?q=${replacedString}&sellSearch=false`);
      } catch (error) {
        console.error('Error navigating to page:', error);
        await browser.close();
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      await page.waitForTimeout(15000);

      const xpathExpression = '//*[@id="app"]/div[1]/div[4]/div[2]/div[1]/div[1]/div/div[3]/div[1]/div[3]/ul/li';
      sectionNames = await page.$x(xpathExpression);
      console.log(sectionNames);
      if (sectionNames.length > 0) {
        const hrefs = [];
        for (const sectionName of sectionNames) {
          const aTag = await sectionName.$('a');
          if (aTag) {
            const href = await aTag.evaluate(element => element.getAttribute('href'));
            hrefs.push(href);
          }
        }
        await browser.close();
        return res.json(hrefs);
      } else {
        await browser.close();
      }
    } while (sectionNames.length === 0);
  } catch (error) {
    console.error('Unhandled error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/stubhubSearch/:query', async (req, res) => {
  const query = req.params.query;
  const replacedString = query.replace(/ /g, "%20");
  try {
    const response = await axios.get(`https://www.stubhub.com/secure/search?q=${replacedString}&sellSearch=false`, {
      rejectUnauthorized: false,
      proxy: {
        host: 'brd.superproxy.io',
        port: '22225',
        auth: {
          username: 'brd-customer-hl_0d698af6-zone-unblocker',
          password: '4rzyw981zlb7'
        }
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);
    console.log($('script').get()[9].attribs['id']);

    const jsonData = $('script[id="index-data"]').first().html();
    const toJson = JSON.parse(jsonData);     // Filter items to extract only the URLs
    const urls = toJson.eventGrids['2'].items.map(item => item.url);

    res.json({
      json: toJson.eventGrids['2'],
      succes: true,
      data: urls
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});


app.post('/stubhubSearchTickets', async (req, res) => {
  const eventURL = req.body.url;
  const CurrentPage = req.body.CurrentPage;
  const PageSize = req.body.PageSize;
  const Quantity = req.body.Quantity;
  const ShowAllTickets = req.body.ShowAllTickets;

  console.log(eventURL);
  try {
    const response = await axios.post(`${eventURL}`, { CurrentPage, PageSize, Quantity, ShowAllTickets }, {
      rejectUnauthorized: false,
      proxy: {
        host: 'brd.superproxy.io',
        port: '22225',
        auth: {
          username: 'brd-customer-hl_0d698af6-zone-unblocker',
          password: '4rzyw981zlb7'
        }
      }
    });

    const html = response.data;
    // Filter items to extract only the URLs
    res.json(html);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/vividseatsSearch/:query', async (req, res) => {
  const query = req.params.query;
  const replacedString = query.replace(/ /g, "%20");
  try {
    const response = await axios.get(`https://www.vividseats.com/search?searchTerm=${replacedString}`, {
      rejectUnauthorized: false,
      proxy: {
        host: 'brd.superproxy.io',
        port: '22225',
        auth: {
          username: 'brd-customer-hl_0d698af6-zone-unblocker',
          password: '4rzyw981zlb7'
        }
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const jsonData = $('script[id="__NEXT_DATA__"]').first().html();
    const toJson = JSON.parse(jsonData);     // Filter items to extract only the URLs


    var baseObjs = toJson.props.pageProps.initialProductionListData;
    var baseObjs2 = toJson.props.pageProps.initialAllProductionListData;
    baseObjs ? baseObjs = baseObjs : baseObjs = baseObjs2

    var urls = baseObjs?.items.map(item => item.id);

    console.log(urls);
    res.json({
      json: baseObjs,
      succes: true,
      data: urls
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/vividseatsSearchTickets/:id', async (req, res) => {
  const eventId = req.params.id;

  try {
    const response = await axios.get(`https://www.vividseats.com/hermes/api/v1/listings?productionId=${eventId}&includeIpAddress=true`, {
      rejectUnauthorized: false,
      proxy: {
        host: 'brd.superproxy.io',
        port: '22225',
        auth: {
          username: 'brd-customer-hl_0d698af6-zone-unblocker',
          password: '4rzyw981zlb7'
        }
      }
    });

    const html = response.data;
    // Filter items to extract only the URLs
    res.json(html);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});



app.get('/gametimeSearch/:query', async (req, res) => {
  const query = req.params.query;

  try {
    const response = await axios.get(`https://mobile.gametime.co/v1/search?q=${query}&lat=40.714353&lon=-74.005973&zSearch03=true&zSearch05=alg_v1`, {
      rejectUnauthorized: false,
      proxy: {
        host: 'brd.superproxy.io',
        port: '22225',
        auth: {
          username: 'brd-customer-hl_0d698af6-zone-unblocker',
          password: '4rzyw981zlb7'
        }
      }
    });

    const html = response.data;
    // Filter items to extract only the URLs
    res.json(html);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});
app.get('/eventsbyequipe/:id', async (req, res) => {
  try {
    const equipe = req.params.id;
    const response = await axios.get(`https://api.seatgeek.com/2/events?client_id=Mzk1MDc3NTh8MTcwNTU5NjQ3Ny44MzQyOTg0&q=${equipe}&per_page=50`);
    console.log(response);
    return res.json(response.data);
  } catch {
    const equipe = req.params.id;
    const response = await axios.get(`https://api.seatgeek.com/2/events?client_id=Mzk1MDc3NTh8MTcwNTU5NjQ3Ny44MzQyOTg0&q=${equipe}&per_page=50`);
    console.log(response);
    return res.json(response.data);
  }

});
app.get('/performers/:name', async (req, res) => {
  const name = req.params.name;

  console.log(name);
  let page = 1;
  let performers = [];
  let total = 0;
  currentFetchs = 50;
  const response = await axios.get(`https://api.seatgeek.com/2/performers?client_id=Mzk1MDc3NTh8MTcwNTU5NjQ3Ny44MzQyOTg0&q=${name}&per_page=50&page=${page}`);
  performers = response.data.performers;
  total = response.data.meta.total;
  page = 2;
  while (currentFetchs < total) {
    page += 1;
    let api = await axios.get(`https://api.seatgeek.com/2/performers?client_id=Mzk1MDc3NTh8MTcwNTU5NjQ3Ny44MzQyOTg0&q=${name}&per_page=50&page=${page}`);
    performers = performers.concat(api.data.performers);
    currentFetchs += 50;
  }
  const filteredPerformers = performers.filter(performer => performer.divisions !== null);
  const sortedPerformers = filteredPerformers.sort((a, b) => {
    const nameA = a.name.toUpperCase(); // Convert to uppercase to ensure case-insensitive sorting
    const nameB = b.name.toUpperCase();

    if (nameA < nameB) {
      return -1; // Return a negative value for ascending order
    } else if (nameA > nameB) {
      return 1; // Return a positive value for ascending order
    } else {
      return 0; // Names are equal
    }
  });
  return res.json({ performers: sortedPerformers, length: filteredPerformers.length });



})
app.post('/getTicketsGametimes', async (req, res) => {
  const url = req.body.url;
  console.log(url);
  //  const replacedString = query.replace(/ /g, "%20");
  try {
    const response = await axios.get(`${url}`, {
      rejectUnauthorized: false,
      proxy: {
        host: 'brd.superproxy.io',
        port: '22225',
        auth: {
          username: 'brd-customer-hl_0d698af6-zone-unblocker',
          password: '4rzyw981zlb7'
        }
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Find all script tags
    const scriptTags = $('script');

    // Get the third-to-last script tag
    const scriptLength = scriptTags.length;
    const thirdToLastScriptTag = scriptTags.eq(scriptLength - 5);

    // Extract the content of the third-to-last script tag
    const jsonData = thirdToLastScriptTag.html();
    // const json = JSON.parse(jsonData);

    const jsonDataStartIndex = jsonData.indexOf('{'); // Find the start index of the JSON object
    const jsonDataEndIndex = jsonData.lastIndexOf('}'); // Find the end index of the JSON object

    if (jsonDataStartIndex !== -1 && jsonDataEndIndex !== -1) {
      const jsonDataString = jsonData.substring(jsonDataStartIndex, jsonDataEndIndex + 1);

      const sanitizedData = jsonDataString
        .replace(/\\u002F/g, '/') // Replace '\\u002F' with '/'
        .replace(/undefined/g, '"undefined "');
      const problematicPart = jsonDataString.substring(180, 250);
      console.log(problematicPart); // Output this to see what's around position 219

      const json = JSON.parse(sanitizedData);
      res.json(json)
    } else {
      console.error("Unable to find JSON object in the extracted data.");
      res.json(scriptLength)    
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
