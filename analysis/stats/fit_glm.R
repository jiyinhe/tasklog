# Load library for stepAIC
library(MASS)

# load data
data<-read.csv('../output/data_-1min_forR.csv')
data$COL<-factor(data$COL)
data$CL<-factor(data$CL)
data$COM<-factor(data$COM)
data$DIF<-factor(data$DIF)
data$FQ<-factor(data$FQ)
data$KP<-factor(data$KP)
data$KT<-factor(data$KT)
data$TL<-factor(data$TL)
data$IMP<-factor(data$IMP)
data$SAT<-factor(data$SAT)
data$STG<-factor(data$STG)
data$UR<-factor(data$UR)

data.df <- data.frame(data)

# user variables
# duration, pageviewserp, multitasking, clicks, pageviews, qbc, queries, pagerevisit, pageviewuniq, qsim        

# select variables for predicting CL 
tdata<-subset(data.df, select=c(CL, pageviewserp, multitasking, clicks, pageviews, qbc, queries, pagerevisit, pageviewuniq))

empty.mod<-polr(CL~1, data=tdata)
full.mod<-polr(CL~   , data=tdata)




# subset explaining multi-tasking
tdata<-subset(data.df, select=c(multitasking, COL, CL, COM, TL,SAT, STG))

#empty models
empty.mod<- glm(formula = multitasking ~ 1 , family=poisson() , data = tdata)

# fit the full model with only user activities
full.mod<-glm(multitasking ~ COL * CL * COM * STG * SAT * TL, data =tdata, family = poisson())

# model selection
# find 1
search.f <- stepAIC(object = empty.mod, scope = list(upper = full.mod), direction = "forward", k = log(nrow(tdata)), trace = TRUE)
search.f$anova

search.b <- stepAIC(object = full.mod, scope = list(lower = empty.mod), direction = "backward", k = log(nrow(tdata)), trace = TRUE)
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


