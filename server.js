const express = require('express') 
const app = express()
const port = 3002
const puppeteer = require("puppeteer");
const bodyParser = require("body-parser");
const cors = require("cors");



app.use(bodyParser.json());
app.use(cors());


const scrapeInfiniteScrollItems = async (page, itemTargetCount,parentId,elementClass) => {
  let items = [];

  if(itemTargetCount<20){
    items = await page.evaluate((className) => {
      const items = Array.from(document.querySelectorAll(`.${className}`));
      return items.map((item) => item.innerText);
    },elementClass );
  }else{
    while (itemTargetCount > items.length) {
      console.log('ok');
      console.log(items);
      items = await page.evaluate((className) => {
        const items = Array.from(document.querySelectorAll(`.${className}`));
        return items.map((item) => item.innerText);
      },elementClass );
  
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
       
        return  '.'+className;
      
      }
    }
    return null;
   
   // return null;
  }, childId);
};

app.post('/stubhubTickets', (req, res) => {
  const eventURL=req.body.url;
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
        const items = await scrapeInfiniteScrollItems(page, parseInt(listingCountClass),parentId,sectionNameClass);
        // Use the class in your items query
        
    
        console.log(items);
        res.send({parentId:parentId , items:items})
    
      
     

     // fs.writeFileSync("items.json", JSON.stringify(items));
   
      await browser.close();
    })();


});

app.get('/getEventBySearchStubHUb/:query',async (req, res) => {
  const query=req.params.query;
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
        if(sectionName.length==0){
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

app.get('/stubhubSearch/:query',async (req, res) => {

  const query=req.params.query;
  const replacedString = query.replace(/ /g, "%20");



  var sectionNames = []; // Increased timeout to 60 seconds
do{

  const browser = await puppeteer.launch();

  const page = await browser.newPage();
  await page.goto(`https://www.stubhub.com/search?q=${replacedString}&sellSearch=false`);
  await page.waitForTimeout(10000);

  const xpathExpression = '//*[@id="app"]/div[1]/div[4]/div[2]/div[1]/div[1]/div/div[3]/div[1]/div[3]/ul/li';
  sectionNames = await page.$x(xpathExpression)
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
  }else{
    await browser.close();

  }
}while(sectionNames.length==0)

  
 // console.log(sectionName);
  //  await browser.close();
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
