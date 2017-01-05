# Load library for stepAIC
library(MASS)
library(nnet)

# load data
data<-read.csv('../output/data_-1min_forR.csv')

data.df <- data.frame(data)
# subset of user activities 
udata <- subset(data.df, select=c(CL, pageviewserp, multitasking, clicks, pageviews,
qbc, queries, pagerevisit, pageviewuniq, qsim)) 

udata$u_level<-factor(udata$CL);

# predict SAT 

#empty models
empty.mod<- glm(formula = SAT ~ 1, family = binomial(link = logit), data = udata)

empty.mod<-multinom(CL~1, data=udata)

empty.mod<-polr(CL~1, data=udata)

# fit the full model with only user activities
full.mod<-glm(SAT ~ ., data =udata, family = binomial(link="logit"))

full.mod<-multinom(CL~., data=udata) 

full.mod<-polr(CL~., data=udata)

# model selection
# find 1
search.f <- stepAIC(object = empty.mod, scope = list(upper = full.mod), direction = "forward", k = log(nrow(udata)), trace = TRUE)
search.f$anova

search.b <- stepAIC(object = full.mod, scope = list(lower = empty.mod), direction = "backward", k = log(nrow(udata)), trace = TRUE)
search.b$anova

# selected model:
# include f_entropy
select1.mod<-diff ~ q_difficulty + u_level + f_entropy + q_difficulty:u_level + q_difficulty:f_entropy

# doesn't include f_entropy:
#select1.mode<-diff ~ q_difficulty + u_level + f_relevance + q_difficulty:f_relevance

model1<-(glm(select1.mod, data=task1, family=binomial(link = logit)))

# find 10
search10.f <- stepAIC(object = empty10.mod, scope = list(upper = full10.mod), direction = "forward", k = log(nrow(task10)), trace = TRUE)
search10.f$anova

search10.b <- stepAIC(object = full10.mod, scope = list(lower = empty10.mod), direction = "backward", k = log(nrow(task10)), trace = TRUE)
search10.b$anova

# selected model
#select10.mod <- diff ~ q_difficulty + u_level + f_relevance + q_difficulty:f_relevance
select10.mod<-diff ~ q_difficulty + u_level + f_entropy + f_relevance + q_difficulty:f_entropy + q_difficulty:f_relevance + f_entropy:f_relevance + q_difficulty:f_entropy:f_relevance

model10<-(glm(select10.mod, data=task10, family=binomial(link = logit)))

# find all
searchall.f <- stepAIC(object = emptyall.mod, scope = list(upper = fullall.mod),direction = "forward", k = log(nrow(taskall)), trace = TRUE)
searchall.f$anova

searchall.b <- stepAIC(object = fullall.mod, scope = list(lower = emptyall.mod), direction = "backward", k = log(nrow(taskall)), trace = TRUE)
searchall.b$anova

# selected model
#selectall.mod <- diff ~ u_level + f_relevance + q_difficulty + f_entropy + f_relevance:f_entropy + f_relevance:q_difficulty
selectall.mod <- diff ~ u_level + f_relevance + q_difficulty + f_entropy + f_relevance:f_entropy + f_relevance:q_difficulty
modelall<-(glm(selectall.mod, data=taskall, family=binomial(link = logit)))


